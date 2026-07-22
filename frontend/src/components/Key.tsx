interface KeyProps {
  /** Visible caption. */
  label: string
  /** Accessible name when the visible caption alone is unclear (e.g. "⌫"). */
  name?: string
  /** Tone group: digits, operators, actions, equals. */
  group: string
  onPress(): void
}

/** One keypad button. Purely presentational: props in, JSX out. */
export function Key({ label, name, group, onPress }: KeyProps) {
  return (
    <button
      type="button"
      className={`key key--${group}`}
      aria-label={name}
      onClick={onPress}
    >
      {label}
    </button>
  )
}
