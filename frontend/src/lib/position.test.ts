import { describe, expect, it } from 'vitest'
import { faultRange } from './position'

describe('faultRange', () => {
  it('maps ASCII byte offsets one-to-one', () => {
    expect(faultRange('2++3', 2)).toEqual({ start: 2, end: 3 })
    expect(faultRange('2++3', 0)).toEqual({ start: 0, end: 1 })
  })

  it('lands on the code point containing a multi-byte offset', () => {
    // '×' is 2 UTF-8 bytes: bytes are [2][××][3]
    expect(faultRange('2×3', 1)).toEqual({ start: 1, end: 2 })
    expect(faultRange('2×3', 2)).toEqual({ start: 1, end: 2 }) // mid-char byte
    expect(faultRange('2×3', 3)).toEqual({ start: 2, end: 3 })
  })

  it('spans surrogate pairs as one unit', () => {
    // '𝟚' (U+1D7DA) is 4 UTF-8 bytes and 2 UTF-16 units.
    expect(faultRange('𝟚+1', 0)).toEqual({ start: 0, end: 2 })
    expect(faultRange('𝟚+1', 4)).toEqual({ start: 2, end: 3 })
  })

  it('returns the empty end range for end-of-input positions', () => {
    expect(faultRange('(2+', 3)).toEqual({ start: 3, end: 3 })
    expect(faultRange('', 0)).toEqual({ start: 0, end: 0 })
  })
})
