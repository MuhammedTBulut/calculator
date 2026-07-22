import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { CalcResult, CalculatorApi } from './api/client'

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

describe('calculator', () => {
  it('evaluates a typed expression and shows the result', async () => {
    const api = apiReturning({ ok: true, value: 14 })
    render(<App api={api} />)

    await clickKeys(['2', 'plus', '3', 'multiply', '4', 'equals'])

    expect(await screen.findByLabelText('result')).toHaveTextContent('14')
    expect(api.evaluate).toHaveBeenCalledWith('2+3*4')
  })

  it('shows the friendly dictionary message for division by zero, not server text', async () => {
    const api = apiReturning({
      ok: false,
      code: 'DIVISION_BY_ZERO',
      message: 'division by zero', // raw server message — must not be shown
    })
    render(<App api={api} />)

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
    render(<App api={api} />)

    await clickKeys(['5', 'equals'])
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByLabelText('result')).toHaveTextContent('5')
    expect(api.evaluate).toHaveBeenCalledTimes(2)
    expect(api.evaluate).toHaveBeenLastCalledWith('5')
  })

  it('keeps history newest first and recalls a past result into the input', async () => {
    const api = apiReturning({ ok: true, value: 14 })
    render(<App api={api} />)

    await clickKeys(['2', 'plus', '3', 'multiply', '4', 'equals'])
    const entry = await screen.findByRole('button', { name: '2+3*4 = 14' })

    // Clear first so the recalled value is distinguishable from the result
    // that submit already left in the buffer.
    await clickKeys(['clear'])
    expect(screen.getByLabelText('result')).toHaveTextContent('0')

    await userEvent.setup().click(entry)
    expect(screen.getByLabelText('result')).toHaveTextContent('14')
  })

  it('submits from the keyboard with Enter', async () => {
    const api = apiReturning({ ok: true, value: 4 })
    render(<App api={api} />)

    await userEvent.setup().keyboard('8/2{Enter}')

    expect(await screen.findByLabelText('result')).toHaveTextContent('4')
    expect(api.evaluate).toHaveBeenCalledWith('8/2')
  })

  it('underlines the exact failing character and names it in the alert', async () => {
    const api = apiReturning({
      ok: false,
      code: 'SYNTAX_ERROR',
      message: 'unexpected operator "+"',
      position: 2, // byte offset of the second '+' in 2++3
    })
    const { container } = render(<App api={api} />)

    await clickKeys(['2', 'plus', 'plus', '3', 'equals'])

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Check the expression — character 3')

    const fault = container.querySelector('[data-fault]')
    expect(fault).not.toBeNull()
    expect(fault).toHaveTextContent('+')
  })

  it('marks an unexpected end of input with an empty caret after the expression', async () => {
    const api = apiReturning({
      ok: false,
      code: 'SYNTAX_ERROR',
      message: 'unexpected end of expression',
      position: 3, // == expression length for "(2+"
    })
    const { container } = render(<App api={api} />)

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
    render(<App api={api} />)
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
    render(<App api={api} />)
    const user = userEvent.setup()

    await clickKeys(['2', 'plus', '3', 'multiply', '4', 'equals'])
    const entry = await screen.findByRole('button', { name: '2+3*4 = 14' })
    await clickKeys(['clear'])

    // Focus the history entry (outside the calculator) and type: WCAG 2.1.4
    // scoping means the keystrokes must not reach the buffer.
    entry.focus()
    await user.keyboard('99')
    expect(screen.getByLabelText('result')).toHaveTextContent('0')
  })

  it('gives every key an accessible name', () => {
    render(<App api={apiReturning()} />)
    const names = [
      'clear', 'delete', 'open parenthesis', 'close parenthesis',
      'square root', 'power', 'percent', 'divide',
      '7', '8', '9', 'multiply', '4', '5', '6', 'minus',
      '1', '2', '3', 'plus', '0', 'decimal point', 'equals',
    ]
    for (const name of names) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('clears a previous error as soon as new input arrives', async () => {
    const api = apiReturning({ ok: false, code: 'SYNTAX_ERROR', message: 'x' })
    render(<App api={api} />)

    await clickKeys(['1', 'plus', 'equals'])
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await clickKeys(['2'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
