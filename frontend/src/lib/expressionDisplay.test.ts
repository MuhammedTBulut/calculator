import { describe, expect, it } from 'vitest'
import {
  expressionDisplaySegments,
  formatExpressionForDisplay,
  formatExpressionForSpeech,
  formatFaultedExpression,
} from './expressionDisplay'

describe('expression display boundary', () => {
  it('keeps parser syntax internal and returns mathematical visual notation', () => {
    expect(formatExpressionForDisplay('2*sqrt(9)/-3^2')).toBe('2×√(9)÷−3^2')
  })

  it('provides explicit operator names for assistive technology', () => {
    expect(formatExpressionForSpeech('2*sqrt(9)/-3^2')).toBe(
      '2 multiplied by square root open parenthesis 9 close parenthesis divided by minus 3 to the power of 2',
    )
  })

  it('preserves parser source ranges for multi-character display tokens', () => {
    expect(expressionDisplaySegments('sqrt(9)')[0]).toEqual({
      sourceStart: 0,
      sourceEnd: 4,
      visual: '√',
    })
  })

  it('formats an error while preserving the parser-positioned fault', () => {
    expect(formatFaultedExpression('sqrt(9)+)', 8, 9)).toEqual({
      before: '√(9)+',
      fault: ')',
      after: '',
    })
  })

  it('maps a fault inside parser-only function text to its visible glyph', () => {
    expect(formatFaultedExpression('sqrt(9)', 2, 3)).toEqual({
      before: '',
      fault: '√',
      after: '(9)',
    })
  })
})
