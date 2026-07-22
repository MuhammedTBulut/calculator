import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalculatorApi } from '../api/client'
import { completeParentheses, repeatOperationFrom, type RepeatOperation } from '../lib/expressionEditing'

/** A calculation error, message already translated for display. */
export interface CalcError {
  code: string
  /** Friendly text derived from `code` via the local dictionary — never raw server text. */
  message: string
  /** Byte offset for SYNTAX_ERROR; used by the display to underline the spot. */
  position?: number
}

/** Keeps client input comfortably below the API's 1 KiB request limit. */
const expressionLimit = 256

/**
 * Friendly messages keyed by machine-readable error code. The UI never
 * parses server message text (the codes are the API contract); server
 * messages are used only as a fallback for codes this dictionary predates.
 */
const messagesByCode: Record<string, string> = {
  DIVISION_BY_ZERO: "Can't divide by zero",
  NEGATIVE_SQRT: "Can't take the square root of a negative number",
  INVALID_OPERAND: 'That number is outside the calculator’s range',
  OVERFLOW: 'The result is too large',
  SYNTAX_ERROR: 'Check the expression',
  UNKNOWN_FUNCTION: 'Unknown function',
  UNKNOWN_OPERATION: 'Unknown operation',
  ARITY_MISMATCH: 'Wrong number of values',
  INVALID_REQUEST: 'The request was not valid',
  REQUEST_TOO_LARGE: 'The expression is too long',
  RATE_LIMITED: 'Too many calculations — wait a moment and try again',
  TIMEOUT: 'The server took too long — try again',
  NETWORK: "Can't reach the server — try again",
  BAD_RESPONSE: 'The server sent an unexpected reply — try again',
  INTERNAL: 'Server error — try again',
  EMPTY_EXPRESSION: 'Enter an expression before calculating',
  EXPRESSION_TOO_LONG: `Keep the expression under ${expressionLimit} characters`,
}

/** Codes where retrying the same expression can plausibly succeed. */
const retryableCodes = new Set(['TIMEOUT', 'NETWORK', 'BAD_RESPONSE', 'INTERNAL', 'RATE_LIMITED'])

export interface UseSubmission {
  loading: boolean
  error: CalcError | null
  /** True when the current error is transient and worth resubmitting. */
  canRetry: boolean
  /** Whole seconds remaining before a rate-limited request may be retried. */
  retryDelaySeconds: number
  /** Sends `expression` (or, if `hasResult`, the repeat-equals form of it) to the API. */
  submit(): void
  /** Clears in-flight/error/retry state and forgets the repeat-equals memory; called whenever the user edits again. */
  reset(): void
}

/**
 * Owns the async request lifecycle: loading, error, retry countdown, and the
 * repeat-equals memory. Knows nothing about how the expression is stored or
 * displayed — it reads the current buffer via `expression`/`hasResult` and
 * reports outcomes through `onSuccess`/`onFailure` rather than writing to
 * buffer or history state directly, so this hook has no dependency on either.
 */
export function useSubmission(
  api: CalculatorApi,
  expression: string,
  hasResult: boolean,
  onSuccess: (submittedExpression: string, result: number) => void,
  onFailure: () => void,
): UseSubmission {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<CalcError | null>(null)
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(0)

  // Submissions are numbered so a stale response (e.g. a slow request
  // resolving after the user already cleared) can never clobber newer state.
  const submissionRef = useRef(0)
  const repeatOperationRef = useRef<RepeatOperation | null>(null)

  useEffect(() => {
    if (retryDelaySeconds <= 0) {
      return
    }
    const timer = window.setTimeout(() => {
      setRetryDelaySeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [retryDelaySeconds])

  const reset = useCallback(() => {
    submissionRef.current++ // invalidate any in-flight submission
    repeatOperationRef.current = null
    setError(null)
    setLoading(false)
    setRetryDelaySeconds(0)
  }, [])

  const submit = useCallback(() => {
    const current = expression.trim()
    const repeatOperation = hasResult ? repeatOperationRef.current : null
    const expr = repeatOperation
      ? `${current}${repeatOperation.operator}${repeatOperation.operand}`
      : completeParentheses(current)
    if (loading) {
      return
    }
    if (expr === '') {
      setError({ code: 'EMPTY_EXPRESSION', message: messagesByCode.EMPTY_EXPRESSION })
      return
    }
    if (expr.length > expressionLimit) {
      setError({ code: 'EXPRESSION_TOO_LONG', message: messagesByCode.EXPRESSION_TOO_LONG })
      return
    }
    const submission = ++submissionRef.current
    setLoading(true)
    setError(null)
    void api.evaluate(expr).then((outcome) => {
      if (submission !== submissionRef.current) {
        return // superseded by reset() — a stale response must not clobber state
      }
      setLoading(false)
      if (outcome.ok) {
        repeatOperationRef.current = repeatOperationFrom(expr)
        setRetryDelaySeconds(0)
        onSuccess(expr, outcome.value)
      } else {
        setRetryDelaySeconds(outcome.retryAfterSeconds ?? 0)
        setError({
          code: outcome.code,
          message: messagesByCode[outcome.code] ?? outcome.message,
          position: outcome.position,
        })
        onFailure()
      }
    })
  }, [api, expression, loading, hasResult, onSuccess, onFailure])

  return {
    loading,
    error: error?.code === 'RATE_LIMITED' && retryDelaySeconds > 0
      ? {
          ...error,
          message: `Too many calculations — try again in ${retryDelaySeconds} ${retryDelaySeconds === 1 ? 'second' : 'seconds'}`,
        }
      : error,
    canRetry: error !== null && retryableCodes.has(error.code),
    retryDelaySeconds,
    submit,
    reset,
  }
}
