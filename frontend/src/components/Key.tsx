interface KeyProps {
  /** Visible caption. */
  label: string
  /** Accessible name when the visible caption alone is unclear (e.g. "⌫"). */
  name?: string
  onPress(): void
}

/** One keypad button. Purely presentational: props in, JSX out. */
export function Key({ label, name, onPress }: KeyProps) {
  return (
    <button type="button" aria-label={name} onClick={onPress}>
      {label}
    </button>
  )
}
