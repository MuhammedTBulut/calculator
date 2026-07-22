import { describe, expect, it } from 'vitest'
import { formatScientificResult } from './numberFormat'

describe('formatScientificResult', () => {
  it.each([
    ['9000000000000000000', '9e18'],
    ['123456789012345', '1.234568e14'],
    ['-0.000000123456789', '-1.234568e-7'],
  ])('formats %s compactly as %s', (value, expected) => {
    expect(formatScientificResult(value)).toBe(expected)
  })

  it('leaves a non-finite value untouched', () => {
    expect(formatScientificResult('not-a-number')).toBe('not-a-number')
  })
})
