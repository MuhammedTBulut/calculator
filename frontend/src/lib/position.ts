/**
 * The API reports syntax positions as 0-based UTF-8 BYTE offsets (see
 * docs/openapi.yaml); JavaScript strings index UTF-16 code units. This
 * converts between the two so the fault needle underlines the right
 * character even in multi-byte input (reviews.md checkpoint-2 note).
 */

export interface FaultRange {
  /** UTF-16 index where the offending code point starts. */
  start: number
  /** UTF-16 index just past the offending code point. */
  end: number
  /**
   * 0-based ordinal of the offending code point — what a person would call
   * "the Nth character". Differs from `start` when astral characters
   * precede the fault (each occupies two UTF-16 units but is one character).
   */
  charIndex: number
}

const utf8 = new TextEncoder()

/**
 * Maps a byte offset to the UTF-16 range of the code point it falls in.
 * An offset at or past the end of the text yields the empty range at the
 * end — "unexpected end of input", rendered as an insertion caret.
 */
export function faultRange(text: string, byteOffset: number): FaultRange {
  let bytes = 0
  let units = 0
  let chars = 0
  for (const cp of text) {
    const cpBytes = utf8.encode(cp).length
    if (byteOffset < bytes + cpBytes) {
      return { start: units, end: units + cp.length, charIndex: chars }
    }
    bytes += cpBytes
    units += cp.length
    chars++
  }
  return { start: text.length, end: text.length, charIndex: chars }
}
