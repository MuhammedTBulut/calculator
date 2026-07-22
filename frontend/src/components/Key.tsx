import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

/** Tone groups a key can belong to; each maps to a `key--<group>` class. */
export type KeyGroup = 'digit' | 'function' | 'operator' | 'action' | 'equals'

interface KeyProps {
  /** Visible caption. */
  label: ReactNode
  /** Accessible name when the visible caption alone is unclear (e.g. "⌫"). */
  name?: string
  /** Tone group: digits, operators, actions, equals. */
  group: KeyGroup
  /** Visual sequence used only by the compact landscape grid. */
  layoutOrder: number
  feedbackSequence?: number
  onFeedback(): void
  onPress(): void
}

/** One keypad button. Purely presentational: props in, JSX out. */
export function Key({
  label,
  name,
  group,
  layoutOrder,
  feedbackSequence,
  onFeedback,
  onPress,
}: KeyProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (feedbackSequence === undefined || !buttonRef.current?.animate) {
      return
    }
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const animation = buttonRef.current.animate(
      reduceMotion
        ? [{ filter: 'brightness(1)' }, { filter: 'brightness(1.18)' }, { filter: 'brightness(1)' }]
        : [
            { transform: 'scale(1)', filter: 'brightness(1)' },
            { transform: 'scale(.95)', filter: 'brightness(1.13)', offset: 0.36 },
            { transform: 'scale(1)', filter: 'brightness(1)' },
          ],
      { duration: reduceMotion ? 100 : 140, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
    return () => animation.cancel()
  }, [feedbackSequence])

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`key key--${group}`}
      aria-label={name}
      style={{ '--landscape-order': layoutOrder } as CSSProperties}
      onPointerDown={onFeedback}
      onClick={(event) => {
        // A keyboard-activated click has detail 0 and no preceding pointer event.
        if (event.detail === 0) {
          onFeedback()
        }
        onPress()
      }}
    >
      {label}
    </button>
  )
}
