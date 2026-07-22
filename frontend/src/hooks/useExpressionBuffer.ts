import { useMemo, useReducer } from 'react'
import {
  appendToken,
  applySquareRootToCurrentOperand,
  deleteLastToken,
  freshValueTokens,
  pendingClosings,
  toggleSignOfCurrentOperand,
} from '../lib/expressionEditing'

interface BufferState {
  expression: string
  /** The expression that produced the current result, until input changes. */
  submittedExpression: string | null
  /** Guidance shown after a printable, unsupported hardware key is pressed. */
  inputWarning: string | null
}

type BufferAction =
  | { type: 'append'; token: string }
  | { type: 'toggleSign' }
  | { type: 'squareRoot' }
  | { type: 'deleteLast' }
  | { type: 'clear' }
  | { type: 'setRaw'; value: string }
  | { type: 'commitResult'; expression: string; result: string }
  | { type: 'clearSubmitted' }
  | { type: 'clearWarning' }
  | { type: 'warnUnsupportedKey'; message: string }

const initialState: BufferState = { expression: '', submittedExpression: null, inputWarning: null }

/**
 * Every edit clears submittedExpression and any input warning as one atomic
 * transition — a reducer reads the CURRENT state directly, so "start fresh
 * after a result" (see 'append') can never see a stale submittedExpression
 * the way a closure captured before a state update could.
 */
function reducer(state: BufferState, action: BufferAction): BufferState {
  switch (action.type) {
    case 'append': {
      const startsFresh = state.submittedExpression !== null && freshValueTokens.has(action.token)
      return {
        expression: appendToken(startsFresh ? '' : state.expression, action.token),
        submittedExpression: null,
        inputWarning: null,
      }
    }
    case 'toggleSign':
      return {
        expression: toggleSignOfCurrentOperand(state.expression),
        submittedExpression: null,
        inputWarning: null,
      }
    case 'squareRoot':
      return {
        expression: applySquareRootToCurrentOperand(state.expression),
        submittedExpression: null,
        inputWarning: null,
      }
    case 'deleteLast':
      return {
        expression: deleteLastToken(state.expression),
        submittedExpression: null,
        inputWarning: null,
      }
    case 'clear':
      return initialState
    case 'setRaw':
      return { expression: action.value, submittedExpression: null, inputWarning: null }
    case 'commitResult':
      return { expression: action.result, submittedExpression: action.expression, inputWarning: null }
    case 'clearSubmitted':
      return { ...state, submittedExpression: null }
    case 'clearWarning':
      return state.inputWarning === null ? state : { ...state, inputWarning: null }
    case 'warnUnsupportedKey':
      return { ...state, inputWarning: action.message }
  }
}

export interface UseExpressionBuffer {
  expression: string
  submittedExpression: string | null
  inputWarning: string | null
  /** Number of inferred closing parentheses previewed after the input. */
  pendingClosingParentheses: number
  append(token: string): void
  toggleSign(): void
  applySquareRoot(): void
  deleteLast(): void
  clear(): void
  /** Overwrites the buffer directly — used by history recall. */
  setRaw(value: string): void
  /** Records a successful submission: result becomes the new buffer, expression becomes submittedExpression. */
  commitResult(expression: string, result: string): void
  /** Reverts an optimistic submission marker after the API call failed. */
  clearSubmitted(): void
  clearWarning(): void
  warnUnsupportedKey(message: string): void
}

/**
 * Owns the expression string, the "showing a result" flag, and the
 * unsupported-key warning — the buffer a calculator keypad edits directly.
 * Knows nothing about the network or history; internal purely to reduce
 * expression-editing edge cases (see lib/expressionEditing.ts) to a single
 * state machine that always reads its own latest state.
 */
export function useExpressionBuffer(): UseExpressionBuffer {
  const [state, dispatch] = useReducer(reducer, initialState)

  // useReducer's dispatch is referentially stable for the component's
  // lifetime, so this object is built once — callers get the same action
  // identities on every render, matching the memoization the callback-per
  // -action original hook provided.
  const actions = useMemo(
    () => ({
      append: (token: string) => dispatch({ type: 'append', token }),
      toggleSign: () => dispatch({ type: 'toggleSign' }),
      applySquareRoot: () => dispatch({ type: 'squareRoot' }),
      deleteLast: () => dispatch({ type: 'deleteLast' }),
      clear: () => dispatch({ type: 'clear' }),
      setRaw: (value: string) => dispatch({ type: 'setRaw', value }),
      commitResult: (expression: string, result: string) =>
        dispatch({ type: 'commitResult', expression, result }),
      clearSubmitted: () => dispatch({ type: 'clearSubmitted' }),
      clearWarning: () => dispatch({ type: 'clearWarning' }),
      warnUnsupportedKey: (message: string) => dispatch({ type: 'warnUnsupportedKey', message }),
    }),
    [],
  )

  return {
    expression: state.expression,
    submittedExpression: state.submittedExpression,
    inputWarning: state.inputWarning,
    pendingClosingParentheses:
      state.submittedExpression === null ? pendingClosings(state.expression) : 0,
    ...actions,
  }
}
