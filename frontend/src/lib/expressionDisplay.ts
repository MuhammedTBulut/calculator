/**
 * One visual token and the range it occupies in the parser expression.
 *
 * Most tokens are one character wide in both representations. Parser-only
 * function names are deliberately kept as a single segment, however, so an
 * error inside `sqrt` can underline the one √ glyph shown to the user.
 */
export interface ExpressionDisplaySegment {
  sourceStart: number
  sourceEnd: number
  visual: string
}

interface TokenPresentation {
  source: string
  visual: string
  spoken: string
}

interface InternalDisplaySegment extends ExpressionDisplaySegment {
  spoken: string
  hasExplicitSpeech: boolean
}

/**
 * The sole parser-to-presentation vocabulary. Multi-character tokens precede
 * single-character ones so extending this table never creates a partial match.
 */
const tokenPresentations: readonly TokenPresentation[] = [
  { source: 'sqrt', visual: '√', spoken: 'square root' },
  { source: '*', visual: '×', spoken: 'multiplied by' },
  { source: '/', visual: '÷', spoken: 'divided by' },
  { source: '-', visual: '−', spoken: 'minus' },
  { source: '+', visual: '+', spoken: 'plus' },
  { source: '^', visual: '^', spoken: 'to the power of' },
  { source: '%', visual: '%', spoken: 'percent' },
  { source: '.', visual: '.', spoken: 'decimal point' },
  { source: '(', visual: '(', spoken: 'open parenthesis' },
  { source: ')', visual: ')', spoken: 'close parenthesis' },
]

function tokenizeExpression(expression: string): InternalDisplaySegment[] {
  const segments: InternalDisplaySegment[] = []

  for (let index = 0; index < expression.length;) {
    const presentation = tokenPresentations.find(({ source }) =>
      expression.startsWith(source, index),
    )
    if (presentation) {
      segments.push({
        sourceStart: index,
        sourceEnd: index + presentation.source.length,
        visual: presentation.visual,
        spoken: presentation.spoken,
        hasExplicitSpeech: true,
      })
      index += presentation.source.length
      continue
    }

    const character = expression[index]
    segments.push({
      sourceStart: index,
      sourceEnd: index + 1,
      visual: character,
      spoken: character,
      hasExplicitSpeech: false,
    })
    index++
  }

  return segments
}

/** Tokenizes parser text without changing the expression used for evaluation. */
export function expressionDisplaySegments(expression: string): ExpressionDisplaySegment[] {
  return tokenizeExpression(expression).map(({ sourceStart, sourceEnd, visual }) => ({
    sourceStart,
    sourceEnd,
    visual,
  }))
}

/** Converts parser syntax into the mathematical notation shown visually. */
export function formatExpressionForDisplay(expression: string): string {
  return tokenizeExpression(expression).map(({ visual }) => visual).join('')
}

/**
 * Produces an explicit, natural label for assistive technology. Symbols stay
 * concise on screen while their meaning is never delegated to a screen
 * reader's platform-specific pronunciation.
 */
export function formatExpressionForSpeech(expression: string): string {
  let spoken = ''

  for (const segment of tokenizeExpression(expression)) {
    spoken += segment.hasExplicitSpeech ? ` ${segment.spoken} ` : segment.spoken
  }

  return spoken.trim().replace(/\s+/g, ' ')
}

/**
 * Formats a parser-positioned fault without losing its source coordinates.
 * This is intentionally owned by the presentation boundary: calculator state
 * and API error offsets continue to refer to the untouched parser expression.
 */
export function formatFaultedExpression(
  expression: string,
  start: number,
  end: number,
): { before: string; fault: string; after: string } {
  const formatted = { before: '', fault: '', after: '' }

  for (const segment of tokenizeExpression(expression)) {
    if (segment.sourceEnd <= start) {
      formatted.before += segment.visual
    } else if (segment.sourceStart >= end) {
      formatted.after += segment.visual
    } else {
      formatted.fault += segment.visual
    }
  }

  return formatted
}
