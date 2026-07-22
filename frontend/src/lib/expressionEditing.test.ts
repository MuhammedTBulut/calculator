import { describe, expect, it } from 'vitest'
import {
  appendToken,
  applySquareRootToCurrentOperand,
  completeParentheses,
  deleteLastToken,
  pendingClosings,
  repeatOperationFrom,
  toggleSignOfCurrentOperand,
} from './expressionEditing'

describe('appendToken', () => {
  it('seeds an empty buffer with zero before a binary operator', () => {
    expect(appendToken('', '+')).toBe('0+')
    expect(appendToken('', '*')).toBe('0*')
  })

  it('replaces a pending operator with the newest one', () => {
    expect(appendToken('5+', '*')).toBe('5*')
  })

  it('inserts zero before an operator right after an opening parenthesis', () => {
    expect(appendToken('(', '+')).toBe('(0+')
  })

  it('starts a decimal with a leading zero after an operator or at the start', () => {
    expect(appendToken('', '.')).toBe('0.')
    expect(appendToken('2+', '.')).toBe('2+0.')
  })

  it('ignores a second decimal point in the same number', () => {
    expect(appendToken('1.5', '.')).toBe('1.5')
  })

  it('replaces a lone leading zero instead of concatenating', () => {
    expect(appendToken('0', '7')).toBe('7')
    expect(appendToken('0', '0')).toBe('0')
    expect(appendToken('2+0', '5')).toBe('2+5')
  })

  it('appends normally once the buffer holds a non-zero digit', () => {
    expect(appendToken('12', '3')).toBe('123')
  })
})

describe('pendingClosings / completeParentheses', () => {
  it('counts only unmatched openings', () => {
    expect(pendingClosings('((1+2)')).toBe(1)
    expect(pendingClosings('(1+2)')).toBe(0)
    expect(pendingClosings(')(')).toBe(1)
  })

  it('appends exactly the missing closers', () => {
    expect(completeParentheses('(1+2')).toBe('(1+2)')
    expect(completeParentheses('((1+2)')).toBe('((1+2))')
    expect(completeParentheses('1+2')).toBe('1+2')
  })
})

describe('toggleSignOfCurrentOperand', () => {
  it('negates a bare buffer', () => {
    expect(toggleSignOfCurrentOperand('')).toBe('-')
  })

  it('toggles only the trailing operand of a longer expression', () => {
    expect(toggleSignOfCurrentOperand('2+3')).toBe('2+-3')
    expect(toggleSignOfCurrentOperand('2+-3')).toBe('2+3')
  })

  it('un-negates by removing the sign rather than double-negating', () => {
    expect(toggleSignOfCurrentOperand('-5')).toBe('5')
  })

  it('toggles a parenthesized or function-call operand as one unit', () => {
    expect(toggleSignOfCurrentOperand('2+sqrt(9)')).toBe('2+-sqrt(9)')
    expect(toggleSignOfCurrentOperand('(1+2)')).toBe('-(1+2)')
  })

  it('keeps a percent suffix attached to the toggled operand', () => {
    expect(toggleSignOfCurrentOperand('50%')).toBe('-50%')
  })
})

describe('applySquareRootToCurrentOperand', () => {
  it('wraps an empty buffer as sqrt(0)', () => {
    expect(applySquareRootToCurrentOperand('')).toBe('sqrt(0)')
  })

  it('wraps only the trailing operand of a longer expression', () => {
    expect(applySquareRootToCurrentOperand('2+9')).toBe('2+sqrt(9)')
  })

  it('wraps a negative trailing operand including its sign', () => {
    expect(applySquareRootToCurrentOperand('4--9')).toBe('4-sqrt(-9)')
  })
})

describe('repeatOperationFrom', () => {
  it('extracts the trailing binary operator and operand', () => {
    expect(repeatOperationFrom('5+2')).toEqual({ operator: '+', operand: '2' })
    expect(repeatOperationFrom('9/3')).toEqual({ operator: '/', operand: '3' })
  })

  it('returns null when the expression is not a binary result', () => {
    expect(repeatOperationFrom('5')).toBeNull()
    expect(repeatOperationFrom('sqrt(9)')).toBeNull()
  })

  it('does not treat a leading unary minus as a repeatable operator', () => {
    expect(repeatOperationFrom('-5')).toBeNull()
  })

  it('treats a negative operand as the repeated operand, not the sign as the operator', () => {
    // 2*-3 repeats "multiply by -3", not "subtract 3" — the '*' is the
    // binary operator, '-3' (unary minus + 3) is the whole operand.
    expect(repeatOperationFrom('2*-3')).toEqual({ operator: '*', operand: '-3' })
  })
})

describe('deleteLastToken', () => {
  it('removes a whole trailing sqrt( call as one token', () => {
    expect(deleteLastToken('2+sqrt(')).toBe('2+')
  })

  it('otherwise removes exactly one character', () => {
    expect(deleteLastToken('123')).toBe('12')
    expect(deleteLastToken('sqrt(9)')).toBe('sqrt(9')
  })
})
