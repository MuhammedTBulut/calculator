import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { CalcResult, CalculatorApi } from './api/client'
import type { Theme, ThemePreferenceStore } from './theme/theme'

class MemoryThemePreferenceStore implements ThemePreferenceStore {
  private theme: Theme | null

  constructor(theme: Theme | null = null) {
    this.theme = theme
  }

  read() {
    return this.theme
  }

  write(theme: Theme) {
    this.theme = theme
  }
}

function renderApp(
  api: CalculatorApi,
  themeStore: ThemePreferenceStore = new MemoryThemePreferenceStore('light'),
) {
  return render(<App api={api} themeStore={themeStore} />)
}

/**
 * The tests mock CalculatorApi — the seam the components actually depend on —
 * never fetch. Each queued CalcResult answers one evaluate() call.
 */
function apiReturning(...results: CalcResult[]): CalculatorApi {
  const evaluate = vi.fn<(expression: string) => Promise<CalcResult>>()
  for (const result of results) {
    evaluate.mockResolvedValueOnce(result)
  }
  return { evaluate }
}

async function clickKeys(names: string[]) {
  const user = userEvent.setup()
  for (const name of names) {
    await user.click(screen.getByRole('button', { name }))
  }
}

afterEach(() => {
  vi.useRealTimers()
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).animate
})

describe('calculator', () => {
  it('uses AC only for an empty calculator and C while content is present', async () => {
    renderApp(apiReturning())
    const clear = screen.getByRole('button', { name: 'clear' })

    expect(clear).toHaveTextContent('AC')

    await clickKeys(['7'])
    expect(clear).toHaveTextContent('C')

    await clickKeys(['delete'])
    expect(clear).toHaveTextContent('AC')

    await clickKeys(['8', 'plus', '2'])
    expect(clear).toHaveTextContent('C')

    await clickKeys(['clear'])
    expect(clear).toHaveTextContent('AC')
    expect(screen.getByLabelText('result')).toHaveTextContent('0')
  })

  it('wraps the current operand with square root and renders mathematical notation', async () => {
    const api = apiReturning({ ok: true, value: 3 })
    renderApp(api)

    await clickKeys(['9', 'square root'])
    expect(screen.getByLabelText('result')).toHaveTextContent('√(9)')
    expect(screen.getByRole('button', { name: 'clear' })).toHaveTextContent('C')

    await clickKeys(['equals'])
    expect(await screen.findByLabelText('result')).toHaveTextContent('3')
    expect(api.evaluate).toHaveBeenCalledWith('sqrt(9)')
    expect(screen.getByText('√(9) =')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'square root open parenthesis 9 close parenthesis equals 3',
    })).toHaveTextContent('√(9)')
  })

  it('applies square root only to the active operand in a longer expression', async () => {
    renderApp(apiReturning())

    await clickKeys(['2', 'plus', '9', 'square root'])

    expect(screen.getByLabelText('result')).toHaveTextContent('2+√(9)')
  })

  it('deletes an emptied square-root token without exposing parser syntax', async () => {
    renderApp(apiReturning())

    await clickKeys(['9', 'square root'])
    for (let press = 0; press < 3; press++) {
      await clickKeys(['delete'])
      expect(screen.getByLabelText('result')).not.toHaveTextContent('sqrt')
    }

    expect(screen.getByLabelText('result')).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'clear' })).toHaveTextContent('AC')
  })

  it('keeps square-root deletion safe when using Backspace', async () => {
    renderApp(apiReturning())
    const user = userEvent.setup()

    await user.keyboard('9')
    await user.click(screen.getByRole('button', { name: 'square root' }))
    await user.keyboard('{Backspace}{Backspace}{Backspace}')

    expect(screen.getByLabelText('result')).toHaveTextContent('0')
    expect(screen.getByLabelText('result')).not.toHaveTextContent('sqrt')
  })

  it('evaluates a typed expression and shows the result', async () => {
    const api = apiReturning({ ok: true, value: 14 })
    renderApp(api)

    await clickKeys(['2', 'plus', '3', 'multiply', '4', 'equals'])

    expect(await screen.findByLabelText('result')).toHaveTextContent('14')
    expect(api.evaluate).toHaveBeenCalledWith('2+3*4')
  })

  it('replaces a pending binary operator with the newest operator', async () => {
    const api = apiReturning({ ok: true, value: 10 })
    renderApp(api)

    await clickKeys(['5', 'plus', 'multiply', '2', 'equals'])

    expect(api.evaluate).toHaveBeenCalledWith('5*2')
  })

  it('normalizes leading zeros and allows one decimal point per number', async () => {
    renderApp(apiReturning())

    await clickKeys(['0', '0', '5', 'decimal point', '2', 'decimal point', '3'])

    expect(screen.getByLabelText('result')).toHaveTextContent('5.23')
  })

  it('starts a decimal number with zero after an operator', async () => {
    renderApp(apiReturning())

    await clickKeys(['2', 'plus', 'decimal point', '5'])

    expect(screen.getByLabelText('result')).toHaveTextContent('2+0.5')
  })

  it('repeats the last binary operation when equals is pressed again', async () => {
    const api = apiReturning(
      { ok: true, value: 7 },
      { ok: true, value: 9 },
      { ok: true, value: 11 },
    )
    renderApp(api)

    await clickKeys(['5', 'plus', '2', 'equals'])
    expect(await screen.findByLabelText('result')).toHaveTextContent('7')

    await clickKeys(['equals'])
    expect(await screen.findByLabelText('result')).toHaveTextContent('9')

    await clickKeys(['equals'])
    expect(await screen.findByLabelText('result')).toHaveTextContent('11')
    expect(api.evaluate).toHaveBeenNthCalledWith(1, '5+2')
    expect(api.evaluate).toHaveBeenNthCalledWith(2, '7+2')
    expect(api.evaluate).toHaveBeenNthCalledWith(3, '9+2')
  })

  it('starts fresh with a digit after a result but continues with an operator', async () => {
    const freshApi = apiReturning({ ok: true, value: 4 })
    const { unmount } = renderApp(freshApi)

    await clickKeys(['2', 'plus', '2', 'equals'])
    expect(await screen.findByLabelText('result')).toHaveTextContent('4')
    await clickKeys(['7'])
    expect(screen.getByLabelText('result')).toHaveTextContent('7')

    unmount()
    const continuedApi = apiReturning({ ok: true, value: 4 }, { ok: true, value: 12 })
    renderApp(continuedApi)
    await clickKeys(['2', 'plus', '2', 'equals'])
    expect(await screen.findByLabelText('result')).toHaveTextContent('4')
    await clickKeys(['multiply', '3', 'equals'])
    expect(continuedApi.evaluate).toHaveBeenLastCalledWith('4*3')
  })

  it.each([
    ['plus', '0+2'],
    ['minus', '0-2'],
    ['multiply', '0*2'],
    ['divide', '0/2'],
    ['power', '0^2'],
  ])('seeds an empty %s operation with the displayed zero', async (key, expression) => {
    const api = apiReturning({ ok: true, value: 0 })
    renderApp(api)

    await clickKeys([key, '2', 'equals'])

    expect(api.evaluate).toHaveBeenCalledWith(expression)
  })

  it('applies empty unary operations to the displayed zero', async () => {
    const percentApi = apiReturning({ ok: true, value: 0 })
    const { unmount } = renderApp(percentApi)

    await clickKeys(['percent', 'equals'])
    expect(percentApi.evaluate).toHaveBeenCalledWith('0%')

    unmount()
    const squareRootApi = apiReturning({ ok: true, value: 0 })
    renderApp(squareRootApi)

    await clickKeys(['square root', 'equals'])
    expect(squareRootApi.evaluate).toHaveBeenCalledWith('sqrt(0)')
  })

  it('uses the same zero-seeded operation behavior from the keyboard', async () => {
    const api = apiReturning({ ok: true, value: 0 })
    renderApp(api)

    await userEvent.setup().keyboard('/2{Enter}')

    expect(api.evaluate).toHaveBeenCalledWith('0/2')
  })

  it('shows the friendly dictionary message for division by zero, not server text', async () => {
    const api = apiReturning({
      ok: false,
      code: 'DIVISION_BY_ZERO',
      message: 'division by zero', // raw server message — must not be shown
    })
    renderApp(api)

    await clickKeys(['1', 'divide', '0', 'equals'])

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Can't divide by zero")
    expect(alert).not.toHaveTextContent('division by zero')
  })

  it('offers retry after a network failure and succeeds on the second attempt', async () => {
    const api = apiReturning(
      { ok: false, code: 'NETWORK', message: 'network failure' },
      { ok: true, value: 5 },
    )
    renderApp(api)

    await clickKeys(['5', 'equals'])
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByLabelText('result')).toHaveTextContent('5')
    expect(api.evaluate).toHaveBeenCalledTimes(2)
    expect(api.evaluate).toHaveBeenLastCalledWith('5')
  })

  it('turns a rate-limit response into friendly retry guidance', async () => {
    const api = apiReturning({
      ok: false,
      code: 'RATE_LIMITED',
      message: 'rate limit exceeded',
    })
    renderApp(api)

    await clickKeys(['5', 'equals'])

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Too many calculations')
    expect(alert).not.toHaveTextContent('rate limit exceeded')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('counts down Retry-After before enabling a rate-limit retry', async () => {
    vi.useFakeTimers()
    const api = apiReturning({
      ok: false,
      code: 'RATE_LIMITED',
      message: 'rate limit exceeded',
      retryAfterSeconds: 2,
    })
    renderApp(api)

    fireEvent.click(screen.getByRole('button', { name: '5' }))
    fireEvent.click(screen.getByRole('button', { name: 'equals' }))
    await act(async () => Promise.resolve())

    expect(screen.getByRole('alert')).toHaveTextContent('try again in 2 seconds')
    expect(screen.getByRole('button', { name: 'Retry in 2 seconds' })).toBeDisabled()

    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByRole('button', { name: 'Retry in 1 second' })).toBeDisabled()
    await act(async () => vi.advanceTimersByTimeAsync(1000))

    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('keeps history newest first and recalls a past result into the input', async () => {
    const api = apiReturning({ ok: true, value: 14 })
    renderApp(api)

    await clickKeys(['2', 'plus', '3', 'multiply', '4', 'equals'])
    const entry = await screen.findByRole('button', {
      name: '2 plus 3 multiplied by 4 equals 14',
    })
    expect(entry).toHaveTextContent('2+3×4')

    // Clear first so the recalled value is distinguishable from the result
    // that submit already left in the buffer.
    await clickKeys(['clear'])
    expect(screen.getByLabelText('result')).toHaveTextContent('0')

    await userEvent.setup().click(entry)
    expect(screen.getByLabelText('result')).toHaveTextContent('14')
  })

  it('submits from the keyboard with Enter', async () => {
    const api = apiReturning({ ok: true, value: 4 })
    renderApp(api)

    await userEvent.setup().keyboard('8/2{Enter}')

    expect(await screen.findByLabelText('result')).toHaveTextContent('4')
    expect(api.evaluate).toHaveBeenCalledWith('8/2')
  })

  it('warns about unsupported printable keyboard input and clears it on valid input', async () => {
    renderApp(apiReturning())
    const user = userEvent.setup()

    await user.keyboard('a')
    expect(screen.getByText(/“a” isn’t a calculator key/)).toBeInTheDocument()

    await user.keyboard('7')
    expect(screen.queryByText(/isn’t a calculator key/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('result')).toHaveTextContent('7')
  })

  it('accepts a comma as a decimal separator from the keyboard', async () => {
    renderApp(apiReturning())

    await userEvent.setup().keyboard('1,5')

    expect(screen.getByLabelText('result')).toHaveTextContent('1.5')
  })

  it('toggles the sign of the current operand without negating the whole expression', async () => {
    renderApp(apiReturning())

    await clickKeys(['2', 'plus', '3', 'toggle sign'])
    expect(screen.getByLabelText('result')).toHaveTextContent('2+−3')

    await clickKeys(['toggle sign'])
    expect(screen.getByLabelText('result')).toHaveTextContent('2+3')
  })

  it('supports F9 as the keyboard shortcut for changing sign', async () => {
    const api = apiReturning({ ok: true, value: -5 })
    renderApp(api)

    await userEvent.setup().keyboard('5{F9}{Enter}')

    expect(await screen.findByLabelText('result')).toHaveTextContent('−5')
    expect(api.evaluate).toHaveBeenCalledWith('-5')
  })

  it('previews and completes missing closing parentheses on submit', async () => {
    const api = apiReturning({ ok: true, value: 3 })
    const { container } = renderApp(api)

    await clickKeys(['open parenthesis', '1', 'plus', '2'])

    expect(container.querySelector('.display__ghost-parenthesis')).toHaveTextContent(')')
    expect(screen.getByLabelText('result')).toHaveAttribute(
      'aria-description',
      '1 closing parenthesis will be added automatically',
    )

    await clickKeys(['equals'])

    expect(api.evaluate).toHaveBeenCalledWith('(1+2)')
    expect(await screen.findByRole('button', {
      name: 'open parenthesis 1 plus 2 close parenthesis equals 3',
    })).toBeInTheDocument()
    expect(container.querySelector('.display__ghost-parenthesis')).not.toBeInTheDocument()
  })

  it('removes the preview when the user enters the closing parenthesis', async () => {
    const { container } = renderApp(apiReturning())

    await clickKeys(['open parenthesis', '7'])
    expect(container.querySelector('.display__ghost-parenthesis')).toHaveTextContent(')')

    await clickKeys(['close parenthesis'])

    expect(container.querySelector('.display__ghost-parenthesis')).not.toBeInTheDocument()
    expect(screen.getByLabelText('result')).toHaveTextContent('(7)')
  })

  it('plays the matching key feedback for hardware keyboard input', async () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }))
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    })
    renderApp(apiReturning())

    await userEvent.setup().keyboard('7')

    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
  })

  it('validates an empty expression before calling the API', async () => {
    const api = apiReturning()
    renderApp(api)

    await clickKeys(['equals'])

    expect(screen.getByRole('alert')).toHaveTextContent('Enter an expression')
    expect(api.evaluate).not.toHaveBeenCalled()
  })

  it('underlines the exact failing character and names it in the alert', async () => {
    const api = apiReturning({
      ok: false,
      code: 'SYNTAX_ERROR',
      message: 'unexpected closing parenthesis',
      position: 2, // byte offset of ')' in 2+)3
    })
    const { container } = renderApp(api)

    await clickKeys(['2', 'plus', 'close parenthesis', '3', 'equals'])

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Check the expression — character 3')

    const fault = container.querySelector('[data-fault]')
    expect(fault).not.toBeNull()
    expect(fault).toHaveTextContent(')')
  })

  it('marks an unexpected end of input with an empty caret after the expression', async () => {
    const api = apiReturning({
      ok: false,
      code: 'SYNTAX_ERROR',
      message: 'unexpected end of expression',
      position: 3, // == expression length for "(2+"
    })
    const { container } = renderApp(api)

    await clickKeys(['open parenthesis', '2', 'plus', 'equals'])

    expect(await screen.findByRole('alert')).toHaveTextContent('character 4')
    const caret = container.querySelector('[data-fault]')
    expect(caret).not.toBeNull()
    expect(caret).toHaveClass('fault--caret')
    expect(caret).toBeEmptyDOMElement()
    // The caret trails the full expression: nothing is underlined, the gap is marked.
    expect(caret!.previousSibling?.textContent).toBe('(2+')
  })

  it('activates the focused button with Enter instead of submitting', async () => {
    const api = apiReturning()
    renderApp(api)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '7' }))
    screen.getByRole('button', { name: 'clear' }).focus()
    await user.keyboard('{Enter}')

    // Enter performed the focused button's action (clear), not submit.
    expect(screen.getByLabelText('result')).toHaveTextContent('0')
    expect(api.evaluate).not.toHaveBeenCalled()
  })

  it('ignores printable shortcuts while focus is in another component', async () => {
    const api = apiReturning({ ok: true, value: 14 })
    renderApp(api)
    const user = userEvent.setup()

    await clickKeys(['2', 'plus', '3', 'multiply', '4', 'equals'])
    const entry = await screen.findByRole('button', {
      name: '2 plus 3 multiplied by 4 equals 14',
    })
    await clickKeys(['clear'])

    // Focus the history entry (outside the calculator) and type: WCAG 2.1.4
    // scoping means the keystrokes must not reach the buffer.
    entry.focus()
    await user.keyboard('99')
    expect(screen.getByLabelText('result')).toHaveTextContent('0')
  })

  it('gives every key an accessible name', () => {
    renderApp(apiReturning())
    const names = [
      'clear', 'delete', 'open parenthesis', 'close parenthesis',
      'square root', 'power', 'percent', 'divide',
      '7', '8', '9', 'multiply', '4', '5', '6', 'minus',
      '1', '2', '3', 'plus', 'toggle sign', '0', 'decimal point', 'equals',
    ]
    for (const name of names) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('keeps the arithmetic operators in a continuous right-hand rail', () => {
    renderApp(apiReturning())

    const keypad = screen.getByRole('group', { name: 'keypad' })
    const keyNames = Array.from(
      keypad.querySelectorAll('button'),
      (button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '',
    )

    expect(keyNames.slice(0, 8)).toEqual([
      'clear', 'delete', 'percent', 'power',
      'open parenthesis', 'close parenthesis', 'square root', 'divide',
    ])
    expect(keyNames.filter((name) =>
      ['divide', 'multiply', 'minus', 'plus', 'equals'].includes(name),
    )).toEqual(['divide', 'multiply', 'minus', 'plus', 'equals'])
    expect(keyNames.slice(-4)).toEqual(['toggle sign', '0', 'decimal point', 'equals'])
  })

  it('clears a previous error as soon as new input arrives', async () => {
    const api = apiReturning({ ok: false, code: 'SYNTAX_ERROR', message: 'x' })
    renderApp(api)

    await clickKeys(['1', 'plus', 'equals'])
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await clickKeys(['2'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('switches appearance and persists the selected theme', async () => {
    const themeStore = new MemoryThemePreferenceStore('light')
    renderApp(apiReturning(), themeStore)
    const user = userEvent.setup()

    const toggle = screen.getByRole('switch', { name: 'Dark mode' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(themeStore.read()).toBe('dark')
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute('aria-checked', 'true')
  })
})
