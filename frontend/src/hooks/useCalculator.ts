import { useCallback, useEffect, useRef, useState } from 'react'
import type { CalculatorApi } from '../api/client'

/** A calculation error, message already translated for display. */
export interface CalcError {
  code: string
  /** Friendly text derived from `code` via the local dictionary — never raw server text. */
  message: string
  /** Byte offset for SYNTAX_ERROR; used by the display to underline the spot. */
  position?: number
}

interface RepeatOperation {
  operator: string
  operand: string
}

/** One completed calculation, newest first in `history`. */
export interface HistoryEntry {
  expression: string
  result: number
}

/** How many past results the session keeps. */
const historyLimit = 10

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

const zeroSeededOperations = new Set(['+', '-', '*', '/', '^', '%'])
const binaryOperations = new Set(['+', '-', '*', '/', '^'])
const freshValueTokens = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '('])

/**
 * Starts an operation from the displayed zero when the input buffer is empty.
 * A dedicated ± action remains the way to begin a negative literal.
 */
function appendToken(expression: string, token: string): string {
  if (expression === '' && zeroSeededOperations.has(token)) {
    return `0${token}`
  }

  if (binaryOperations.has(token)) {
    if (expression.endsWith('(')) {
      return `${expression}0${token}`
    }
    const pendingOperators = expression.match(/[+\-*/^]+$/)
    if (pendingOperators) {
      const prefix = expression.slice(0, -pendingOperators[0].length)
      return `${prefix || '0'}${token}`
    }
  }

  if (token === '.') {
    if (expression === '' || /[+\-*/^(]$/.test(expression)) {
      return `${expression}0.`
    }
    const activeNumber = expression.match(/(?:\d+(?:\.\d*)?|\.\d+)$/)?.[0]
    if (!activeNumber || activeNumber.includes('.')) {
      return expression
    }
  }

  if (/^\d$/.test(token)) {
    const leadingZero = expression.match(/(^|[+\-*/^(])(-?)0$/)
    if (leadingZero) {
      return token === '0' ? expression : expression.slice(0, -1) + token
    }
  }
  return expression + token
}

/** Returns the number of opening groups that still need a closing parenthesis. */
function pendingClosings(expression: string): number {
  let balance = 0
  for (const character of expression) {
    if (character === '(') {
      balance++
    } else if (character === ')' && balance > 0) {
      balance--
    }
  }
  return balance
}

/** Completes only missing closing parentheses; every other token stays untouched. */
function completeParentheses(expression: string): string {
  return expression + ')'.repeat(pendingClosings(expression))
}

function isUnaryMinus(expression: string, index: number): boolean {
  return index === 0 || '+-*/^('.includes(expression[index - 1])
}

interface OperandRange {
  start: number
  end: number
}

/** Finds the complete trailing operand, including a unary sign and percent suffix. */
function trailingOperandRange(expression: string): OperandRange | null {
  let operandCoreEnd = expression.length
  while (operandCoreEnd > 0 && expression[operandCoreEnd - 1] === '%') {
    operandCoreEnd--
  }

  let operandStart = operandCoreEnd
  if (expression[operandCoreEnd - 1] === ')') {
    let balance = 0
    for (let index = operandCoreEnd - 1; index >= 0; index--) {
      if (expression[index] === ')') {
        balance++
      } else if (expression[index] === '(') {
        balance--
        if (balance === 0) {
          operandStart = index
          while (operandStart > 0 && /[a-z]/i.test(expression[operandStart - 1])) {
            operandStart--
          }
          break
        }
      }
    }
  } else {
    const number = expression
      .slice(0, operandCoreEnd)
      .match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i)
    if (number) {
      operandStart = operandCoreEnd - number[0].length
    }
  }

  if (operandStart === operandCoreEnd) {
    return null
  }

  const signIndex = operandStart - 1
  if (signIndex >= 0 && expression[signIndex] === '-' && isUnaryMinus(expression, signIndex)) {
    operandStart = signIndex
  }

  return { start: operandStart, end: expression.length }
}

/**
 * Toggles the final operand instead of negating the whole expression.
 * This keeps chained input calculator-like: `2+3` becomes `2+-3`, while
 * a completed result such as `5` becomes `-5`.
 */
function toggleSignOfCurrentOperand(expression: string): string {
  if (expression === '') {
    return '-'
  }

  const trailingIndex = expression.length - 1
  if (expression[trailingIndex] === '-' && isUnaryMinus(expression, trailingIndex)) {
    return expression.slice(0, trailingIndex)
  }

  const operand = trailingOperandRange(expression)
  if (!operand) {
    return expression + '-'
  }

  if (expression[operand.start] === '-' && isUnaryMinus(expression, operand.start)) {
    return expression.slice(0, operand.start) + expression.slice(operand.start + 1)
  }
  return expression.slice(0, operand.start) + '-' + expression.slice(operand.start)
}

/** Wraps the current operand like a native unary square-root operation. */
function applySquareRootToCurrentOperand(expression: string): string {
  const operand = trailingOperandRange(expression)
  if (!operand) {
    return expression === '' ? 'sqrt(0)' : expression + 'sqrt('
  }
  return expression.slice(0, operand.start)
    + `sqrt(${expression.slice(operand.start, operand.end)})`
}

function repeatOperationFrom(expression: string): RepeatOperation | null {
  const operand = trailingOperandRange(expression)
  if (!operand || operand.start === 0) {
    return null
  }
  const operatorIndex = operand.start - 1
  const operator = expression[operatorIndex]
  if (!binaryOperations.has(operator) || isUnaryMinus(expression, operatorIndex)) {
    return null
  }
  return { operator, operand: expression.slice(operand.start) }
}

/** Removes parser-only function syntax as one token once its argument is empty. */
function deleteLastToken(expression: string): string {
  if (expression.endsWith('sqrt(')) {
    return expression.slice(0, -'sqrt('.length)
  }
  return expression.slice(0, -1)
}

function unsupportedKeyMessage(key: string): string {
  const name = key === ' ' ? 'Space' : key
  return `“${name}” isn’t a calculator key. Use numbers or + − × ÷.`
}

/**
 * Owns every piece of calculator state; components under src/components are
 * pure props-in/JSX-out. The API is injected so tests substitute a mock.
 */
export function useCalculator(api: CalculatorApi): UseCalculator {
  const [expression, setExpression] = useState('')
  const [submittedExpression, setSubmittedExpression] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<CalcError | null>(null)
  const [inputWarning, setInputWarning] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
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

  const append = useCallback((token: string) => {
    submissionRef.current++
    repeatOperationRef.current = null
    setError(null)
    setInputWarning(null)
    setLoading(false)
    setRetryDelaySeconds(0)
    const startsFresh = submittedExpression !== null && freshValueTokens.has(token)
    setSubmittedExpression(null)
    setExpression((current) => appendToken(startsFresh ? '' : current, token))
  }, [submittedExpression])

  const toggleSign = useCallback(() => {
    submissionRef.current++
    repeatOperationRef.current = null
    setError(null)
    setInputWarning(null)
    setLoading(false)
    setRetryDelaySeconds(0)
    setSubmittedExpression(null)
    setExpression(toggleSignOfCurrentOperand)
  }, [])

  const applySquareRoot = useCallback(() => {
    submissionRef.current++
    repeatOperationRef.current = null
    setError(null)
    setInputWarning(null)
    setLoading(false)
    setRetryDelaySeconds(0)
    setSubmittedExpression(null)
    setExpression(applySquareRootToCurrentOperand)
  }, [])

  const deleteLast = useCallback(() => {
    submissionRef.current++
    repeatOperationRef.current = null
    setError(null)
    setInputWarning(null)
    setLoading(false)
    setRetryDelaySeconds(0)
    setSubmittedExpression(null)
    setExpression(deleteLastToken)
  }, [])

  const clear = useCallback(() => {
    submissionRef.current++ // invalidate any in-flight submission
    repeatOperationRef.current = null
    setError(null)
    setInputWarning(null)
    setLoading(false)
    setRetryDelaySeconds(0)
    setSubmittedExpression(null)
    setExpression('')
  }, [])

  const recall = useCallback((entry: HistoryEntry) => {
    submissionRef.current++
    repeatOperationRef.current = null
    setError(null)
    setInputWarning(null)
    setLoading(false)
    setRetryDelaySeconds(0)
    setSubmittedExpression(null)
    setExpression(String(entry.result))
  }, [])

  const submit = useCallback(() => {
    const current = expression.trim()
    const repeatOperation = submittedExpression !== null ? repeatOperationRef.current : null
    const expr = repeatOperation
      ? `${current}${repeatOperation.operator}${repeatOperation.operand}`
      : completeParentheses(current)
    setInputWarning(null)
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
    setSubmittedExpression(null)
    void api.evaluate(expr).then((outcome) => {
      if (submission !== submissionRef.current) {
        return // superseded by clear() — a stale response must not clobber state
      }
      setLoading(false)
      if (outcome.ok) {
        repeatOperationRef.current = repeatOperationFrom(expr)
        setRetryDelaySeconds(0)
        setHistory((past) =>
          [{ expression: expr, result: outcome.value }, ...past].slice(0, historyLimit),
        )
        // The result becomes the next buffer, like a physical calculator.
        setSubmittedExpression(expr)
        setExpression(String(outcome.value))
      } else {
        setSubmittedExpression(null)
        setRetryDelaySeconds(outcome.retryAfterSeconds ?? 0)
        setError({
          code: outcome.code,
          message: messagesByCode[outcome.code] ?? outcome.message,
          position: outcome.position,
        })
      }
    })
  }, [api, expression, loading, submittedExpression])

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
        setInputWarning(unsupportedKeyMessage(key))
        return true
      }
      return false
    },
    [submit, deleteLast, clear, toggleSign, append],
  )

  return {
    expression,
    pendingClosingParentheses: submittedExpression === null ? pendingClosings(expression) : 0,
    submittedExpression,
    loading,
    error: error?.code === 'RATE_LIMITED' && retryDelaySeconds > 0
      ? {
          ...error,
          message: `Too many calculations — try again in ${retryDelaySeconds} ${retryDelaySeconds === 1 ? 'second' : 'seconds'}`,
        }
      : error,
    inputWarning,
    canRetry: error !== null && retryableCodes.has(error.code),
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
