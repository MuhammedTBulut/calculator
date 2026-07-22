import { useCallback } from 'react'
import type { CalculatorApi } from '../api/client'
import { useExpressionBuffer } from './useExpressionBuffer'
import { useCalculationHistory, type HistoryEntry } from './useCalculationHistory'
import { useSubmission, type CalcError } from './useSubmission'

export type { CalcError } from './useSubmission'
export type { HistoryEntry } from './useCalculationHistory'

export interface UseCalculator {
  /** The input buffer; after a successful submit it holds the result. */
  expression: string
  /** Number of inferred closing parentheses previewed after the input. */
  pendingClosingParentheses: number
  /** The expression that produced the current result, until input changes. */
  submittedExpression: string | null
  loading: boolean
  error: CalcError | null
  /** Guidance shown after a printable, unsupported hardware key is pressed. */
  inputWarning: string | null
  /** True when the current error is transient and worth resubmitting. */
  canRetry: boolean
  /** Whole seconds remaining before a rate-limited request may be retried. */
  retryDelaySeconds: number
  history: HistoryEntry[]
  append(token: string): void
  /** Applies square root to the operand currently being entered. */
  applySquareRoot(): void
  /** Reverses the sign of the operand currently being entered. */
  toggleSign(): void
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

const keyboardTokens: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.', ',': '.', '+': '+', '-': '-', '*': '*', '/': '/',
  '^': '^', '%': '%', '(': '(', ')': ')',
}

function unsupportedKeyMessage(key: string): string {
  const name = key === ' ' ? 'Space' : key
  return `“${name}” isn’t a calculator key. Use numbers or + − × ÷.`
}

/**
 * Composes three single-purpose hooks — the expression buffer, the
 * submission/retry lifecycle, and calculation history — into the surface
 * components consume. Each sub-hook owns its own state and knows nothing
 * about the others; this hook is the only place that wires them together
 * (e.g. every edit action resets in-flight submission state, a successful
 * submission both commits the result to the buffer and records history).
 *
 * Sub-hook actions are destructured to plain bindings (rather than accessed
 * as `buffer.append` inline) purely so useCallback dependency arrays name
 * stable identifiers directly — buffer/submission are new object references
 * every render even though their individual action functions are memoized.
 */
export function useCalculator(api: CalculatorApi): UseCalculator {
  const {
    expression,
    submittedExpression,
    inputWarning,
    pendingClosingParentheses,
    append: bufferAppend,
    toggleSign: bufferToggleSign,
    applySquareRoot: bufferApplySquareRoot,
    deleteLast: bufferDeleteLast,
    clear: bufferClear,
    setRaw,
    commitResult,
    clearSubmitted,
    clearWarning,
    warnUnsupportedKey,
  } = useExpressionBuffer()

  const { history, addEntry } = useCalculationHistory()

  const handleSuccess = useCallback(
    (submitted: string, result: number) => {
      addEntry({ expression: submitted, result })
      commitResult(submitted, String(result))
    },
    [addEntry, commitResult],
  )

  const handleFailure = useCallback(() => {
    clearSubmitted()
  }, [clearSubmitted])

  const {
    loading,
    error,
    canRetry,
    retryDelaySeconds,
    submit: submissionSubmit,
    reset: submissionReset,
  } = useSubmission(api, expression, submittedExpression !== null, handleSuccess, handleFailure)

  // Every edit invalidates whatever the submission hook was doing — a
  // stale response for the expression the user just changed must not land.
  const append = useCallback((token: string) => {
    submissionReset()
    bufferAppend(token)
  }, [submissionReset, bufferAppend])

  const toggleSign = useCallback(() => {
    submissionReset()
    bufferToggleSign()
  }, [submissionReset, bufferToggleSign])

  const applySquareRoot = useCallback(() => {
    submissionReset()
    bufferApplySquareRoot()
  }, [submissionReset, bufferApplySquareRoot])

  const deleteLast = useCallback(() => {
    submissionReset()
    bufferDeleteLast()
  }, [submissionReset, bufferDeleteLast])

  const clear = useCallback(() => {
    submissionReset()
    bufferClear()
  }, [submissionReset, bufferClear])

  const recall = useCallback((entry: HistoryEntry) => {
    submissionReset()
    setRaw(String(entry.result))
  }, [submissionReset, setRaw])

  const submit = useCallback(() => {
    clearWarning()
    submissionSubmit()
  }, [clearWarning, submissionSubmit])

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
      if (key === 'F9') {
        toggleSign()
        return true
      }
      const token = keyboardTokens[key]
      if (token !== undefined) {
        append(token)
        return true
      }
      if (key.length === 1) {
        warnUnsupportedKey(unsupportedKeyMessage(key))
        return true
      }
      return false
    },
    [submit, deleteLast, clear, toggleSign, append, warnUnsupportedKey],
  )

  return {
    expression,
    pendingClosingParentheses,
    submittedExpression,
    loading,
    error,
    inputWarning,
    canRetry,
    retryDelaySeconds,
    history,
    append,
    applySquareRoot,
    toggleSign,
    deleteLast,
    clear,
    submit,
    recall,
    handleKey,
  }
}
