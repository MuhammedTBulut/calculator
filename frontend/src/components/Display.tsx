import { useEffect, useRef } from 'react'
import type { CalcError } from '../hooks/useCalculator'
import { faultRange } from '../lib/position'

interface DisplayProps {
  expression: string
  error: CalcError | null
  loading: boolean
}

/**
 * The instrument read-out. In an error state with a position, the offending
 * character carries the fault needle — an accent underline marking the exact
 * spot the parser stopped; an end-of-input fault renders as an insertion
 * caret after the expression. The alert text carries the same information
 * ("character N", counted in characters, not UTF-16 units) so the needle is
 * never visual-only.
 */
export function Display({ expression, error, loading }: DisplayProps) {
  const fault = error?.position != null ? faultRange(expression, error.position) : null
  const readoutRef = useRef<HTMLOutputElement>(null)

  // The readout is a horizontal scroller; a fault in a long expression may
  // sit outside the visible window, so bring it into view. (Guarded: jsdom
  // has no scrollIntoView.)
  const faultStart = fault?.start
  useEffect(() => {
    if (faultStart != null) {
      readoutRef.current?.querySelector('[data-fault]')?.scrollIntoView?.({
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [faultStart, expression])

  return (
    <div className="display">
      {/* tabIndex makes the scrollable readout keyboard-reachable
          (arrow-key scrolling), per WCAG scrollable-region guidance. */}
      <output
        className="display__readout"
        aria-live="polite"
        aria-label="result"
        tabIndex={0}
        ref={readoutRef}
      >
        {fault ? (
          <FaultedExpression expression={expression} start={fault.start} end={fault.end} />
        ) : expression === '' ? (
          '0'
        ) : (
          expression
        )}
      </output>
      {loading && (
        <p className="display__status" role="status">
          Calculating…
        </p>
      )}
      {error && (
        <p className="display__error" role="alert">
          {error.message}
          {fault && ` — character ${fault.charIndex + 1}`}
        </p>
      )}
    </div>
  )
}

function FaultedExpression({
  expression,
  start,
  end,
}: {
  expression: string
  start: number
  end: number
}) {
  if (start === end) {
    // Unexpected end of input: nothing to underline, so mark the gap.
    return (
      <>
        {expression}
        <span className="fault fault--caret" data-fault aria-hidden="true" />
      </>
    )
  }
  return (
    <>
      {expression.slice(0, start)}
      <span className="fault" data-fault>
        {expression.slice(start, end)}
      </span>
      {expression.slice(end)}
    </>
  )
}
