import { Key } from './Key'

interface KeypadProps {
  onInput(token: string): void
  onSubmit(): void
  onDelete(): void
  onClear(): void
}

/**
 * Physical-calculator row order: actions and functions above, the digit
 * block below, equals anchoring the corner. The discriminated union keeps
 * behavior explicit: an input key carries the token it appends; an action
 * key names which handler it fires — no field does double duty.
 */
type KeySpec =
  | { kind: 'input'; label: string; token: string; group: 'digit' | 'operator'; name?: string }
  | { kind: 'action'; label: string; action: 'clear' | 'delete' | 'submit'; group: 'action' | 'equals'; name: string }

const layout: KeySpec[] = [
  { kind: 'action', label: 'C', action: 'clear', group: 'action', name: 'clear' },
  { kind: 'action', label: '⌫', action: 'delete', group: 'action', name: 'delete' },
  { kind: 'input', label: '(', token: '(', group: 'operator', name: 'open parenthesis' },
  { kind: 'input', label: ')', token: ')', group: 'operator', name: 'close parenthesis' },
  { kind: 'input', label: '√', token: 'sqrt(', group: 'operator', name: 'square root' },
  { kind: 'input', label: '^', token: '^', group: 'operator', name: 'power' },
  { kind: 'input', label: '%', token: '%', group: 'operator', name: 'percent' },
  { kind: 'input', label: '÷', token: '/', group: 'operator', name: 'divide' },
  { kind: 'input', label: '7', token: '7', group: 'digit' },
  { kind: 'input', label: '8', token: '8', group: 'digit' },
  { kind: 'input', label: '9', token: '9', group: 'digit' },
  { kind: 'input', label: '×', token: '*', group: 'operator', name: 'multiply' },
  { kind: 'input', label: '4', token: '4', group: 'digit' },
  { kind: 'input', label: '5', token: '5', group: 'digit' },
  { kind: 'input', label: '6', token: '6', group: 'digit' },
  { kind: 'input', label: '−', token: '-', group: 'operator', name: 'minus' },
  { kind: 'input', label: '1', token: '1', group: 'digit' },
  { kind: 'input', label: '2', token: '2', group: 'digit' },
  { kind: 'input', label: '3', token: '3', group: 'digit' },
  { kind: 'input', label: '+', token: '+', group: 'operator', name: 'plus' },
  { kind: 'input', label: '0', token: '0', group: 'digit' },
  { kind: 'input', label: '.', token: '.', group: 'digit', name: 'decimal point' },
  { kind: 'action', label: '=', action: 'submit', group: 'equals', name: 'equals' },
]

/** The button grid. Purely presentational: props in, JSX out. */
export function Keypad({ onInput, onSubmit, onDelete, onClear }: KeypadProps) {
  const actions: Record<'clear' | 'delete' | 'submit', () => void> = {
    clear: onClear,
    delete: onDelete,
    submit: onSubmit,
  }

  return (
    <div className="keypad" role="group" aria-label="keypad">
      {layout.map((spec) => (
        <Key
          key={spec.label}
          label={spec.label}
          name={spec.name}
          group={spec.group}
          onPress={spec.kind === 'input' ? () => onInput(spec.token) : actions[spec.action]}
        />
      ))}
    </div>
  )
}
