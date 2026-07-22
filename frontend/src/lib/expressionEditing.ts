/**
 * Pure string-level rules for editing and repeating a calculator expression.
 * No React here — these are unit-tested directly and reused by the
 * expression-buffer and submission hooks without either depending on the
 * other's internals.
 */

export interface RepeatOperation {
  operator: string
  operand: string
}

interface OperandRange {
  start: number
  end: number
}

export const zeroSeededOperations = new Set(['+', '-', '*', '/', '^', '%'])
export const binaryOperations = new Set(['+', '-', '*', '/', '^'])
export const freshValueTokens = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '('])

/**
 * Starts an operation from the displayed zero when the input buffer is empty.
 * A dedicated ± action remains the way to begin a negative literal.
 */
export function appendToken(expression: string, token: string): string {
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
export function pendingClosings(expression: string): number {
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
export function completeParentheses(expression: string): string {
  return expression + ')'.repeat(pendingClosings(expression))
}

export function isUnaryMinus(expression: string, index: number): boolean {
  return index === 0 || '+-*/^('.includes(expression[index - 1])
}

/** Finds the complete trailing operand, including a unary sign and percent suffix. */
export function trailingOperandRange(expression: string): OperandRange | null {
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
export function toggleSignOfCurrentOperand(expression: string): string {
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
export function applySquareRootToCurrentOperand(expression: string): string {
  const operand = trailingOperandRange(expression)
  if (!operand) {
    return expression === '' ? 'sqrt(0)' : expression + 'sqrt('
  }
  return expression.slice(0, operand.start)
    + `sqrt(${expression.slice(operand.start, operand.end)})`
}

/** Reads the operator and operand a completed result would repeat on a bare equals press. */
export function repeatOperationFrom(expression: string): RepeatOperation | null {
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
export function deleteLastToken(expression: string): string {
  if (expression.endsWith('sqrt(')) {
    return expression.slice(0, -'sqrt('.length)
  }
  return expression.slice(0, -1)
}
