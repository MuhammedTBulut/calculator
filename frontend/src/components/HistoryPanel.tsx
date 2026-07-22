import type { HistoryEntry } from '../hooks/useCalculator'

interface HistoryPanelProps {
  history: HistoryEntry[]
  onRecall(entry: HistoryEntry): void
}

/** Past results, newest first; each is a button that recalls its result. */
export function HistoryPanel({ history, onRecall }: HistoryPanelProps) {
  if (history.length === 0) {
    return null
  }
  return (
    <section className="history" aria-label="history">
      <h2 className="history__title">History</h2>
      <ul className="history__list">
        {history.map((entry, i) => (
          <li key={`${i}-${entry.expression}`}>
            <button
              type="button"
              className="history__entry"
              // The visual layout splits the equation across two spans; the
              // label restores the natural spoken form.
              aria-label={`${entry.expression} = ${entry.result}`}
              onClick={() => onRecall(entry)}
            >
              <span className="history__expression">{entry.expression}</span>
              <span className="history__result">{entry.result}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
