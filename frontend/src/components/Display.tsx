import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CalcError } from '../hooks/useCalculator'
import { faultRange } from '../lib/position'
import { formatScientificResult } from '../lib/numberFormat'
import {
  formatExpressionForDisplay,
  formatFaultedExpression,
} from '../lib/expressionDisplay'

interface DisplayProps {
  expression: string
  pendingClosingParentheses: number
  submittedExpression: string | null
  error: CalcError | null
  warning: string | null
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
export function Display({
  expression,
  pendingClosingParentheses,
  submittedExpression,
  error,
  warning,
  loading,
}: DisplayProps) {
  const fault = error?.position != null ? faultRange(expression, error.position) : null
  const readoutRef = useRef<HTMLOutputElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const [useScientificNotation, setUseScientificNotation] = useState(false)
  const isResult = submittedExpression !== null

  // Results keep their full numeric value in calculator state so subsequent
  // operations remain parser-compatible. Only the visual representation is
  // compacted, and only when the rendered glyphs exceed the available width.
  useLayoutEffect(() => {
    if (!isResult) {
      setUseScientificNotation(false)
      return
    }

    const updateFit = () => {
      const readout = readoutRef.current
      const measure = measureRef.current
      if (!readout || !measure) {
        return
      }
      const style = window.getComputedStyle(readout)
      const horizontalPadding = (Number.parseFloat(style.paddingLeft) || 0)
        + (Number.parseFloat(style.paddingRight) || 0)
      const availableWidth = Math.max(0, readout.clientWidth - horizontalPadding)
      setUseScientificNotation(measure.getBoundingClientRect().width > availableWidth)
    }

    updateFit()
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateFit)
      observer.observe(readoutRef.current!)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', updateFit)
    return () => window.removeEventListener('resize', updateFit)
  }, [expression, isResult])

  const fullDisplayedExpression = formatExpressionForDisplay(expression)
  const displayedExpression = isResult && useScientificNotation
    ? formatExpressionForDisplay(formatScientificResult(expression))
    : fullDisplayedExpression
  const inferredClosings = !isResult && !error ? pendingClosingParentheses : 0
  const visibleCharacterCount = Array.from(displayedExpression).length + inferredClosings
  const readoutDensity = visibleCharacterCount > 15
    ? 'ultra'
    : visibleCharacterCount > 10
      ? 'dense'
      : visibleCharacterCount > 6
        ? 'compact'
        : 'regular'
  const readoutDescription = useScientificNotation
    ? `Full result: ${expression}`
    : inferredClosings > 0
      ? `${inferredClosings} closing ${inferredClosings === 1 ? 'parenthesis' : 'parentheses'} will be added automatically`
      : undefined

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
      <div className={`display__screen${submittedExpression ? ' display__screen--result' : ''}`}>
        {loading && (
          <div className="display__message display__message--status" role="status">
            <p>Calculating…</p>
          </div>
        )}
        {warning && !error && (
          <div className="display__message display__message--warning" role="status">
            <p>{warning}</p>
          </div>
        )}
        {error && (
          <div className="display__message display__message--error" role="alert">
            <p>
              {error.message}
              {fault && ` — character ${fault.charIndex + 1}`}
            </p>
          </div>
        )}
        {submittedExpression && (
          <p className="display__previous" aria-hidden="true">
            {formatExpressionForDisplay(submittedExpression)} =
          </p>
        )}
        <output
          className={`display__readout display__readout--${readoutDensity}`}
          data-density={readoutDensity}
          aria-live="polite"
          aria-label="result"
          aria-description={readoutDescription}
          tabIndex={0}
          ref={readoutRef}
        >
          {fault ? (
            <FaultedExpression expression={expression} start={fault.start} end={fault.end} />
          ) : displayedExpression === '' ? (
            '0'
          ) : (
            <span className="display__value">
              {displayedExpression}
              {inferredClosings > 0 && (
                <span className="display__ghost-parenthesis" aria-hidden="true">
                  {')'.repeat(inferredClosings)}
                </span>
              )}
            </span>
          )}
        </output>
        {isResult && (
          <span className="display__measure" aria-hidden="true" ref={measureRef}>
            {fullDisplayedExpression}
          </span>
        )}
      </div>
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
        {formatExpressionForDisplay(expression)}
        <span className="fault fault--caret" data-fault aria-hidden="true" />
      </>
    )
  }
  const formatted = formatFaultedExpression(expression, start, end)
  return (
    <>
      {formatted.before}
      <span className="fault" data-fault>
        {formatted.fault}
      </span>
      {formatted.after}
    </>
  )
}
