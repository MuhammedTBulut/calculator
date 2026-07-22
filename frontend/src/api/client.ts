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
  | { ok: false; code: string; message: string; position?: number }

/**
 * The single seam between the UI and the backend. Components never call
 * fetch; they receive an implementation of this interface (the tests inject
 * a mock, main.tsx injects HttpCalculatorApi).
 */
export interface CalculatorApi {
  /** Evaluates one infix expression on the server. Never throws. */
  evaluate(expression: string): Promise<CalcResult>
}

/** Milliseconds before an in-flight request is abandoned as TIMEOUT. */
const defaultTimeoutMs = 5000

/** HTTP implementation of CalculatorApi against the Go backend. */
export class HttpCalculatorApi implements CalculatorApi {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(
    baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
    timeoutMs: number = defaultTimeoutMs,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.timeoutMs = timeoutMs
  }

  async evaluate(expression: string): Promise<CalcResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression }),
        signal: controller.signal,
      })
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

/**
 * Normalizes an HTTP response into a CalcResult, treating any body that does
 * not match the documented contract as BAD_RESPONSE rather than guessing.
 */
async function toCalcResult(response: Response): Promise<CalcResult> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
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
  return { ok: false, code: error.code, message: error.message, position: error.position }
}
