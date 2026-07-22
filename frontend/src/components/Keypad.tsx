import { Key } from './Key'

interface KeypadProps {
  onInput(token: string): void
  onSubmit(): void
  onDelete(): void
  onClear(): void
}

/**
 * Physical-calculator row order: actions and functions above, the digit
 * block below, equals anchoring the corner. `group` maps to tone classes —
 * key groups are distinguished by weight and tone, not color.
 */
type KeyGroup = 'digit' | 'operator' | 'action' | 'equals'

interface KeySpec {
  label: string
  name?: string
  group: KeyGroup
  /** Token appended to the buffer; null marks an action key. */
  token: string | null
}

const layout: KeySpec[] = [
  { label: 'C', name: 'clear', group: 'action', token: null },
  { label: '⌫', name: 'delete', group: 'action', token: null },
  { label: '(', name: 'open parenthesis', group: 'operator', token: '(' },
  { label: ')', name: 'close parenthesis', group: 'operator', token: ')' },
  { label: '√', name: 'square root', group: 'operator', token: 'sqrt(' },
  { label: '^', name: 'power', group: 'operator', token: '^' },
  { label: '%', name: 'percent', group: 'operator', token: '%' },
  { label: '÷', name: 'divide', group: 'operator', token: '/' },
  { label: '7', group: 'digit', token: '7' },
  { label: '8', group: 'digit', token: '8' },
  { label: '9', group: 'digit', token: '9' },
  { label: '×', name: 'multiply', group: 'operator', token: '*' },
  { label: '4', group: 'digit', token: '4' },
  { label: '5', group: 'digit', token: '5' },
  { label: '6', group: 'digit', token: '6' },
  { label: '−', name: 'minus', group: 'operator', token: '-' },
  { label: '1', group: 'digit', token: '1' },
  { label: '2', group: 'digit', token: '2' },
  { label: '3', group: 'digit', token: '3' },
  { label: '+', name: 'plus', group: 'operator', token: '+' },
  { label: '0', group: 'digit', token: '0' },
  { label: '.', name: 'decimal point', group: 'digit', token: '.' },
  { label: '=', name: 'equals', group: 'equals', token: null },
]

/** The button grid. Purely presentational: props in, JSX out. */
export function Keypad({ onInput, onSubmit, onDelete, onClear }: KeypadProps) {
  const actionFor = (spec: KeySpec): (() => void) => {
    if (spec.token !== null) {
      const token = spec.token
      return () => onInput(token)
    }
    switch (spec.name) {
      case 'clear':
        return onClear
      case 'delete':
        return onDelete
      default:
        return onSubmit
    }
  }

  return (
    <div className="keypad" role="group" aria-label="keypad">
      {layout.map((spec) => (
        <Key
          key={spec.label}
          label={spec.label}
          name={spec.name}
          group={spec.group}
          onPress={actionFor(spec)}
        />
      ))}
    </div>
  )
}
