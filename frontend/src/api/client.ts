import type { CalculateResponse, ErrorEnvelope } from '../types/api'

/**
 * Every calculation outcome as a discriminated union — no exceptions cross
 * this boundary. `code` is either a server ApiErrorCode or one of the
 * client-side codes: TIMEOUT (request exceeded the deadline), NETWORK
 * (fetch failed), BAD_RESPONSE (the server replied with something that is
 * not the documented contract).
 */
export type CalcResult =
  | { ok: true; value: number }
  | {
      ok: false
      code: string
      message: string
      position?: number
      retryAfterSeconds?: number
    }

/**
 * The single seam between the UI and the backend. Components never call
 * fetch; they receive an implementation of this interface (the tests inject
 * a mock, main.tsx injects HttpCalculatorApi).
 */
export interface CalculatorApi {
  /** Evaluates one infix expression on the server. Never throws. */
  evaluate(expression: string): Promise<CalcResult>
}

/**
 * Render free services can need close to a minute to wake from an idle state.
 * Keep one deadline across the initial request and its cold-start retry.
 */
const defaultTimeoutMs = 60_000

/** Gateway statuses Render can emit transiently while the backend wakes. */
const retryableGatewayStatuses = new Set([502, 503, 504])

/** A cold Render service commonly needs several seconds before it accepts traffic. */
const defaultGatewayRetryDelayMs = 2_000
const maxGatewayAttempts = 10

/**
 * Resolves only after the backend reports healthy. The application bootstrap
 * uses this as a gate, so calculator controls cannot appear before they work.
 */
export async function waitForBackend(signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      const response = await fetch('/api/health', {
        cache: 'no-store',
        signal,
      })
      if (response.ok) {
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
    }
    await delay(defaultGatewayRetryDelayMs, signal)
  }
  throw new DOMException('aborted', 'AbortError')
}

/** HTTP implementation of CalculatorApi against the Go backend. */
export class HttpCalculatorApi implements CalculatorApi {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly gatewayRetryDelayMs: number

  constructor(
    baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
    timeoutMs: number = defaultTimeoutMs,
    gatewayRetryDelayMs: number = defaultGatewayRetryDelayMs,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeoutMs = timeoutMs
    this.gatewayRetryDelayMs = gatewayRetryDelayMs
  }

  async evaluate(expression: string): Promise<CalcResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const request = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression }),
        signal: controller.signal,
      }
      let response: Response
      for (let attempt = 1; ; attempt++) {
        response = await fetch(`${this.baseUrl}/calculate`, request)
        if (
          !retryableGatewayStatuses.has(response.status)
          || attempt >= maxGatewayAttempts
        ) {
          break
        }

        // The failed POST never reached the application, so retrying this
        // pure calculation is safe. Spacing attempts gives a sleeping Render
        // instance time to boot instead of exhausting retries immediately.
        await delay(this.gatewayRetryDelayMs, controller.signal)
      }
      return await toCalcResult(response)
    } catch (err) {
      // AbortError is our own timeout firing; anything else is the network.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, code: 'TIMEOUT', message: 'request timed out' }
      }
      return { ok: false, code: 'NETWORK', message: 'network failure' }
    } finally {
      clearTimeout(timer)
    }
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    }, { once: true })
  })
}

/**
 * Normalizes an HTTP response into a CalcResult, treating any body that does
 * not match the documented contract as BAD_RESPONSE rather than guessing.
 */
async function toCalcResult(response: Response): Promise<CalcResult> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.status >= 500) {
      return { ok: false, code: 'INTERNAL', message: 'server gateway failure' }
    }
    return { ok: false, code: 'BAD_RESPONSE', message: 'server response was not JSON' }
  }

  if (response.ok) {
    const result = (body as CalculateResponse).result
    if (typeof result !== 'number') {
      return { ok: false, code: 'BAD_RESPONSE', message: 'server response missing result' }
    }
    return { ok: true, value: result }
  }

  const error = (body as ErrorEnvelope).error
  if (typeof error?.code !== 'string' || typeof error?.message !== 'string') {
    return { ok: false, code: 'BAD_RESPONSE', message: 'server error had no envelope' }
  }
  const retryAfter = response.headers.get('Retry-After')
  const retryAfterSeconds = retryAfter && /^[1-9]\d*$/.test(retryAfter)
    ? Number.parseInt(retryAfter, 10)
    : undefined
  const result: CalcResult = {
    ok: false,
    code: error.code,
    message: error.message,
    position: error.position,
  }
  return retryAfterSeconds === undefined ? result : { ...result, retryAfterSeconds }
}
