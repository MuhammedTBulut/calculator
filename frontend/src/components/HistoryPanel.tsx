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
    <section aria-label="history">
      <ul>
        {history.map((entry, i) => (
          <li key={`${i}-${entry.expression}`}>
            <button type="button" onClick={() => onRecall(entry)}>
              {entry.expression} = {entry.result}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
