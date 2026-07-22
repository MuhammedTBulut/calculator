import { useCallback, useState } from 'react'

export interface KeyFeedback {
  key: string | null
  sequence: number
  pulse(key: string): void
}

/**
 * Produces a monotonic signal for keypad feedback. Keeping this separate from
 * calculator state lets pointer and hardware-keyboard input share one motion
 * path without mixing visual timing into calculation logic.
 */
export function useKeyFeedback(): KeyFeedback {
  const [feedback, setFeedback] = useState<Omit<KeyFeedback, 'pulse'>>({
    key: null,
    sequence: 0,
  })

  const pulse = useCallback((key: string) => {
    setFeedback((current) => ({ key, sequence: current.sequence + 1 }))
  }, [])

  return { ...feedback, pulse }
}
