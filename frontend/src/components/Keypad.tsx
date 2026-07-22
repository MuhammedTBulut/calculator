import { Key } from './Key'

interface KeypadProps {
  onInput(token: string): void
  onSubmit(): void
  onDelete(): void
  onClear(): void
}

/**
 * Key layout as label/token pairs. A null token marks the action keys that
 * do not append to the buffer. "sqrt(" is one token: the function name is
 * only meaningful with its opening parenthesis.
 */
const inputKeys: Array<{ label: string; token: string; name?: string }> = [
  { label: '7', token: '7' }, { label: '8', token: '8' }, { label: '9', token: '9' },
  { label: '4', token: '4' }, { label: '5', token: '5' }, { label: '6', token: '6' },
  { label: '1', token: '1' }, { label: '2', token: '2' }, { label: '3', token: '3' },
  { label: '0', token: '0' }, { label: '.', token: '.', name: 'decimal point' },
  { label: '+', token: '+', name: 'plus' },
  { label: '−', token: '-', name: 'minus' },
  { label: '×', token: '*', name: 'multiply' },
  { label: '÷', token: '/', name: 'divide' },
  { label: '^', token: '^', name: 'power' },
  { label: '%', token: '%', name: 'percent' },
  { label: '√', token: 'sqrt(', name: 'square root' },
  { label: '(', token: '(', name: 'open parenthesis' },
  { label: ')', token: ')', name: 'close parenthesis' },
]

/** The button grid. Purely presentational: props in, JSX out. */
export function Keypad({ onInput, onSubmit, onDelete, onClear }: KeypadProps) {
  return (
    <div role="group" aria-label="keypad">
      {inputKeys.map(({ label, token, name }) => (
        <Key key={token} label={label} name={name} onPress={() => onInput(token)} />
      ))}
      <Key label="⌫" name="delete" onPress={onDelete} />
      <Key label="C" name="clear" onPress={onClear} />
      <Key label="=" name="equals" onPress={onSubmit} />
    </div>
  )
}
