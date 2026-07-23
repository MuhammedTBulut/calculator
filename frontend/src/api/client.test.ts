import { afterEach, describe, expect, it, vi } from 'vitest'
import { HttpCalculatorApi, warmBackend } from './client'

/**
 * These are the one place fetch is stubbed: this class exists to wrap fetch,
 * so its collaborator has to be controlled to exercise the normalization
 * branches. Component tests still mock CalculatorApi, never fetch.
 */
function stubFetch(impl: () => Promise<Response> | Response) {
  // Typed as fetch itself so mock.calls carries the real (input, init) tuple.
  const spy = vi.fn<typeof fetch>(() => Promise.resolve(impl()))
  vi.stubGlobal('fetch', spy)
  return spy
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('HttpCalculatorApi', () => {
  it('warms the backend without blocking startup', async () => {
    const spy = stubFetch(() => jsonResponse({ status: 'ok' }))

    expect(warmBackend()).toBeUndefined()
    expect(spy).toHaveBeenCalledWith('/api/health', { cache: 'no-store' })
  })

  it('posts the expression to the configured base URL and unwraps the result', async () => {
    const spy = stubFetch(() => jsonResponse({ result: 14 }))
    const api = new HttpCalculatorApi('http://api.test/api/v1')

    await expect(api.evaluate('2+3*4')).resolves.toEqual({ ok: true, value: 14 })

    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/calculate')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse(init!.body as string)).toEqual({ expression: '2+3*4' })
  })

  it('strips a trailing slash from the base URL', async () => {
    const spy = stubFetch(() => jsonResponse({ result: 1 }))
    await new HttpCalculatorApi('http://api.test/api/v1/').evaluate('1')
    expect(spy.mock.calls[0][0]).toBe('http://api.test/api/v1/calculate')
  })

  it('carries the error envelope through, including the syntax position', async () => {
    stubFetch(() =>
      jsonResponse(
        { error: { code: 'SYNTAX_ERROR', message: 'unexpected operator "+"', position: 2 } },
        422,
      ),
    )
    const api = new HttpCalculatorApi('http://api.test/api/v1')

    await expect(api.evaluate('2++3')).resolves.toEqual({
      ok: false,
      code: 'SYNTAX_ERROR',
      message: 'unexpected operator "+"',
      position: 2,
    })
  })

  it('carries a valid Retry-After delay from a rate-limit response', async () => {
    stubFetch(() => jsonResponse(
      { error: { code: 'RATE_LIMITED', message: 'rate limit exceeded' } },
      429,
      { 'Retry-After': '3' },
    ))

    await expect(new HttpCalculatorApi('http://api.test/api/v1').evaluate('1+1')).resolves.toEqual({
      ok: false,
      code: 'RATE_LIMITED',
      message: 'rate limit exceeded',
      position: undefined,
      retryAfterSeconds: 3,
    })
  })

  it('reports a network failure as NETWORK', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const api = new HttpCalculatorApi('http://api.test/api/v1')

    await expect(api.evaluate('1+1')).resolves.toEqual({
      ok: false,
      code: 'NETWORK',
      message: 'network failure',
    })
  })

  it('reports an exceeded deadline as TIMEOUT', async () => {
    // The stub never settles on its own; only the abort signal ends it.
    stubFetch(
      () =>
        new Promise<Response>((_, reject) => {
          setTimeout(() => reject(new DOMException('aborted', 'AbortError')), 50)
        }),
    )
    const api = new HttpCalculatorApi('http://api.test/api/v1', 10)

    await expect(api.evaluate('1+1')).resolves.toEqual({
      ok: false,
      code: 'TIMEOUT',
      message: 'request timed out',
    })
  })

  it('retries a transient Render gateway response after a boot delay', async () => {
    const spy = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }))
      .mockResolvedValueOnce(jsonResponse({ result: 144 }))
    vi.stubGlobal('fetch', spy)

    await expect(new HttpCalculatorApi('http://api.test/api/v1', 60_000, 0).evaluate('12*12'))
      .resolves.toEqual({ ok: true, value: 144 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('reports a persistent non-JSON gateway failure as INTERNAL', async () => {
    const spy = stubFetch(() => new Response('<html>502</html>', { status: 502 }))

    await expect(new HttpCalculatorApi('http://api.test/api/v1', 60_000, 0).evaluate('1+1')).resolves.toEqual({
      ok: false,
      code: 'INTERNAL',
      message: 'server gateway failure',
    })
    expect(spy).toHaveBeenCalledTimes(10)
  })

  it('rejects responses that do not match the documented contract', async () => {
    const cases: Array<{ name: string; response: () => Response }> = [
      { name: 'not JSON', response: () => new Response('<html>502</html>', { status: 200 }) },
      { name: 'success without a numeric result', response: () => jsonResponse({ answer: 14 }) },
      { name: 'error without an envelope', response: () => jsonResponse({ oops: true }, 500) },
    ]
    for (const { name, response } of cases) {
      stubFetch(response)
      const result = await new HttpCalculatorApi('http://api.test/api/v1').evaluate('1+1')
      expect(result, name).toMatchObject({ ok: false, code: 'BAD_RESPONSE' })
    }
  })
})
