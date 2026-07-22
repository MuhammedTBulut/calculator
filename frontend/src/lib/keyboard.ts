const keypadNamesByKeyboardKey: Record<string, string> = {
  Enter: 'equals', '=': 'equals', Backspace: 'delete', Escape: 'clear',
  F9: 'toggle sign',
  '.': 'decimal point', ',': 'decimal point', '+': 'plus', '-': 'minus',
  '*': 'multiply', '/': 'divide', '^': 'power', '%': 'percent',
  '(': 'open parenthesis', ')': 'close parenthesis',
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
}

/** Returns the keypad control that represents a supported hardware key. */
export function keyNameForKeyboardInput(key: string): string | null {
  return keypadNamesByKeyboardKey[key] ?? null
}
