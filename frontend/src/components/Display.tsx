import type { CalcError } from '../hooks/useCalculator'

interface DisplayProps {
  expression: string
  error: CalcError | null
  loading: boolean
}

/** The calculator's read-out: current buffer, busy state, and last error. */
export function Display({ expression, error, loading }: DisplayProps) {
  return (
    <div>
      {/* aria-live lets screen readers announce results without focus moves. */}
      <output aria-live="polite" aria-label="result">
        {expression === '' ? '0' : expression}
      </output>
      {loading && <p role="status">Calculating…</p>}
      {error && <p role="alert">{error.message}</p>}
    </div>
  )
}
