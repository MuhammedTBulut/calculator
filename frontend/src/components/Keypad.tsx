import { Key } from './Key'
import { BackspaceIcon } from '@phosphor-icons/react/dist/csr/Backspace'
import { PlusMinusIcon } from '@phosphor-icons/react/dist/csr/PlusMinus'
import type { ReactNode } from 'react'

interface KeypadProps {
  clearLabel: 'AC' | 'C'
  onInput(token: string): void
  onSubmit(): void
  onDelete(): void
  onClear(): void
  onSquareRoot(): void
  onToggleSign(): void
  activeKey: string | null
  feedbackSequence: number
  onFeedback(key: string): void
}

/**
 * Physical-calculator row order: actions and functions above, the digit
 * block below, equals anchoring the corner. The discriminated union keeps
 * behavior explicit: an input key carries the token it appends; an action
 * key names which handler it fires — no field does double duty.
 */
type KeySpec =
  | {
      kind: 'input'
      id: string
      label: string
      token: string
      group: 'digit' | 'function' | 'operator'
      name?: string
    }
  | {
      kind: 'action'
      id: string
      label: ReactNode
      action: 'clear' | 'delete' | 'squareRoot' | 'toggleSign' | 'submit'
      group: 'digit' | 'function' | 'action' | 'equals'
      name: string
    }

const layout: KeySpec[] = [
  { kind: 'action', id: 'clear', label: 'AC', action: 'clear', group: 'action', name: 'clear' },
  {
    kind: 'action', id: 'delete',
    label: <BackspaceIcon size={31} weight="regular" aria-hidden="true" />,
    action: 'delete', group: 'action', name: 'delete',
  },
  { kind: 'input', id: 'percent', label: '%', token: '%', group: 'function', name: 'percent' },
  { kind: 'input', id: 'power', label: 'xʸ', token: '^', group: 'function', name: 'power' },
  { kind: 'input', id: 'open parenthesis', label: '(', token: '(', group: 'function', name: 'open parenthesis' },
  { kind: 'input', id: 'close parenthesis', label: ')', token: ')', group: 'function', name: 'close parenthesis' },
  {
    kind: 'action', id: 'square root', label: '√', action: 'squareRoot',
    group: 'function', name: 'square root',
  },
  { kind: 'input', id: 'divide', label: '÷', token: '/', group: 'operator', name: 'divide' },
  { kind: 'input', id: '7', label: '7', token: '7', group: 'digit' },
  { kind: 'input', id: '8', label: '8', token: '8', group: 'digit' },
  { kind: 'input', id: '9', label: '9', token: '9', group: 'digit' },
  { kind: 'input', id: 'multiply', label: '×', token: '*', group: 'operator', name: 'multiply' },
  { kind: 'input', id: '4', label: '4', token: '4', group: 'digit' },
  { kind: 'input', id: '5', label: '5', token: '5', group: 'digit' },
  { kind: 'input', id: '6', label: '6', token: '6', group: 'digit' },
  { kind: 'input', id: 'minus', label: '−', token: '-', group: 'operator', name: 'minus' },
  { kind: 'input', id: '1', label: '1', token: '1', group: 'digit' },
  { kind: 'input', id: '2', label: '2', token: '2', group: 'digit' },
  { kind: 'input', id: '3', label: '3', token: '3', group: 'digit' },
  { kind: 'input', id: 'plus', label: '+', token: '+', group: 'operator', name: 'plus' },
  {
    kind: 'action', id: 'toggle sign',
    label: <PlusMinusIcon size={32} weight="regular" aria-hidden="true" />,
    action: 'toggleSign', group: 'digit', name: 'toggle sign',
  },
  { kind: 'input', id: '0', label: '0', token: '0', group: 'digit' },
  { kind: 'input', id: 'decimal point', label: '.', token: '.', group: 'digit', name: 'decimal point' },
  { kind: 'action', id: 'equals', label: '=', action: 'submit', group: 'equals', name: 'equals' },
]

// Landscape keeps every capability while grouping actions, digits and
// arithmetic into four scan-friendly rows instead of compressing to 8 × 3.
const landscapeOrder = [
  'clear', 'delete', 'percent', 'power', 'open parenthesis', 'close parenthesis',
  '7', '8', '9', 'square root', 'divide', 'multiply',
  '4', '5', '6', 'toggle sign', 'minus', 'plus',
  '1', '2', '3', '0', 'decimal point', 'equals',
] as const

const landscapeOrderById: ReadonlyMap<string, number> = new Map(
  landscapeOrder.map((id, index) => [id, index]),
)

/** The button grid. Purely presentational: props in, JSX out. */
export function Keypad({
  clearLabel,
  onInput,
  onSubmit,
  onDelete,
  onClear,
  onSquareRoot,
  onToggleSign,
  activeKey,
  feedbackSequence,
  onFeedback,
}: KeypadProps) {
  const actions: Record<'clear' | 'delete' | 'squareRoot' | 'toggleSign' | 'submit', () => void> = {
    clear: onClear,
    delete: onDelete,
    squareRoot: onSquareRoot,
    toggleSign: onToggleSign,
    submit: onSubmit,
  }

  return (
    <div className="keypad" role="group" aria-label="keypad">
      {layout.map((spec) => (
        <Key
          key={spec.id}
          label={spec.id === 'clear' ? clearLabel : spec.label}
          name={spec.name}
          group={spec.group}
          layoutOrder={landscapeOrderById.get(spec.id) ?? 0}
          feedbackSequence={activeKey === spec.id ? feedbackSequence : undefined}
          onFeedback={() => onFeedback(spec.id)}
          onPress={spec.kind === 'input' ? () => onInput(spec.token) : actions[spec.action]}
        />
      ))}
    </div>
  )
}
