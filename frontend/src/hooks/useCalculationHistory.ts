import { useCallback, useState } from 'react'

/** One completed calculation, newest first in `history`. */
export interface HistoryEntry {
  expression: string
  result: number
}

/** How many past results the session keeps. */
const historyLimit = 10

export interface UseCalculationHistory {
  history: HistoryEntry[]
  /** Records a completed calculation, newest first, trimmed to historyLimit. */
  addEntry(entry: HistoryEntry): void
}

/** Owns the session's calculation history. No knowledge of the buffer or the network. */
export function useCalculationHistory(): UseCalculationHistory {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const addEntry = useCallback((entry: HistoryEntry) => {
    setHistory((past) => [entry, ...past].slice(0, historyLimit))
  }, [])

  return { history, addEntry }
}
