import { useCallback, useRef, useState } from 'react'
import type { CalculatorApi } from '../api/client'

/** A calculation error, message already translated for display. */
export interface CalcError {
  code: string
  /** Friendly text derived from `code` via the local dictionary — never raw server text. */
  message: string
  /** Byte offset for SYNTAX_ERROR; used by the display to underline the spot. */
  position?: number
}

/** One completed calculation, newest first in `history`. */
export interface HistoryEntry {
  expression: string
  result: number
}

/** How many past results the session keeps. */
const historyLimit = 10

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
  TIMEOUT: 'The server took too long — try again',
  NETWORK: "Can't reach the server — try again",
  BAD_RESPONSE: 'The server sent an unexpected reply — try again',
  INTERNAL: 'Server error — try again',
}

/** Codes where retrying the same expression can plausibly succeed. */
const retryableCodes = new Set(['TIMEOUT', 'NETWORK', 'BAD_RESPONSE', 'INTERNAL'])

export interface UseCalculator {
  /** The input buffer; after a successful submit it holds the result. */
  expression: string
  loading: boolean
  error: CalcError | null
  /** True when the current error is transient and worth resubmitting. */
  canRetry: boolean
  history: HistoryEntry[]
  append(token: string): void
  deleteLast(): void
  clear(): void
  submit(): void
  /** Puts a past result back into the buffer to continue calculating with it. */
  recall(entry: HistoryEntry): void
  /**
   * Maps a KeyboardEvent.key to the same actions as the keypad buttons.
   * Returns true when the key was consumed (callers preventDefault on it).
   */
  handleKey(key: string): boolean
}

const inputKeys = new Set([
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '.', '+', '-', '*', '/', '^', '%', '(', ')',
])

/**
 * Owns every piece of calculator state; components under src/components are
 * pure props-in/JSX-out. The API is injected so tests substitute a mock.
 */
export function useCalculator(api: CalculatorApi): UseCalculator {
  const [expression, setExpression] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<CalcError | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // Submissions are numbered so a stale response (e.g. a slow request
  // resolving after the user already cleared) can never clobber newer state.
  const submissionRef = useRef(0)

  const append = useCallback((token: string) => {
    setError(null)
    setExpression((current) => current + token)
  }, [])

  const deleteLast = useCallback(() => {
    setError(null)
    setExpression((current) => current.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    submissionRef.current++ // invalidate any in-flight submission
    setError(null)
    setLoading(false)
    setExpression('')
  }, [])

  const recall = useCallback((entry: HistoryEntry) => {
    setError(null)
    setExpression(String(entry.result))
  }, [])

  const submit = useCallback(() => {
    const expr = expression.trim()
    if (expr === '' || loading) {
      return
    }
    const submission = ++submissionRef.current
    setLoading(true)
    setError(null)
    void api.evaluate(expr).then((outcome) => {
      if (submission !== submissionRef.current) {
        return // superseded by clear() — a stale response must not clobber state
      }
      setLoading(false)
      if (outcome.ok) {
        setHistory((past) =>
          [{ expression: expr, result: outcome.value }, ...past].slice(0, historyLimit),
        )
        // The result becomes the next buffer, like a physical calculator.
        setExpression(String(outcome.value))
      } else {
        setError({
          code: outcome.code,
          message: messagesByCode[outcome.code] ?? outcome.message,
          position: outcome.position,
        })
      }
    })
  }, [api, expression, loading])

  const handleKey = useCallback(
    (key: string): boolean => {
      if (key === 'Enter' || key === '=') {
        submit()
        return true
      }
      if (key === 'Backspace') {
        deleteLast()
        return true
      }
      if (key === 'Escape') {
        clear()
        return true
      }
      if (inputKeys.has(key)) {
        append(key)
        return true
      }
      return false
    },
    [submit, deleteLast, clear, append],
  )

  return {
    expression,
    loading,
    error,
    canRetry: error !== null && retryableCodes.has(error.code),
    history,
    append,
    deleteLast,
    clear,
    submit,
    recall,
    handleKey,
  }
}
