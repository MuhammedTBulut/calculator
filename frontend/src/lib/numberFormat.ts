/**
 * Formats a finite calculator result as compact scientific notation.
 * Seven significant digits preserve useful precision without recreating an
 * unreadably long value in the constrained result line.
 */
export function formatScientificResult(value: string): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return value
  }

  const [rawMantissa, rawExponent] = numeric.toExponential(6).split('e')
  const mantissa = rawMantissa.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
  const exponent = Number(rawExponent)
  return `${mantissa}e${exponent}`
}
