import type { HistoryEntry } from '../hooks/useCalculator'
import {
  formatExpressionForDisplay,
  formatExpressionForSpeech,
} from '../lib/expressionDisplay'

interface HistoryPanelProps {
  history: HistoryEntry[]
  onRecall(entry: HistoryEntry): void
}

/** Past results, newest first; each is a button that recalls its result. */
export function HistoryPanel({ history, onRecall }: HistoryPanelProps) {
  return (
    <section className="history" aria-label="history">
      <div className="history__header">
        <h2>History</h2>
        <span className="history__count" aria-label={`${history.length} saved results`}>
          {history.length}/10
        </span>
      </div>

      {history.length === 0 ? (
        <div className="history__empty">
          <p>No calculations yet.</p>
        </div>
      ) : (
        <ul className="history__list">
          {history.map((entry, i) => (
            <li key={`${i}-${entry.expression}`}>
              <button
                type="button"
                className="history__entry"
                // The visual layout splits the equation across two spans; the
                // label restores the natural spoken form.
                aria-label={`${formatExpressionForSpeech(entry.expression)} equals ${formatExpressionForSpeech(String(entry.result))}`}
                onClick={() => onRecall(entry)}
              >
                <span className="history__index" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="history__equation">
                  <span className="history__expression">
                    {formatExpressionForDisplay(entry.expression)}
                  </span>
                  <span className="history__result">
                    {formatExpressionForDisplay(String(entry.result))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
