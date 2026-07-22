import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Display } from './Display'

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')

afterEach(() => {
  vi.restoreAllMocks()
  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  } else {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
  }
})

describe('Display', () => {
  it('reduces readout density in steps as the visible expression grows', () => {
    const props = {
      pendingClosingParentheses: 0,
      submittedExpression: null,
      error: null,
      warning: null,
      loading: false,
    }
    const { rerender } = render(<Display {...props} expression="99999" />)

    expect(screen.getByLabelText('result')).toHaveAttribute('data-density', 'regular')

    rerender(<Display {...props} expression="123456789" />)
    expect(screen.getByLabelText('result')).toHaveAttribute('data-density', 'compact')

    rerender(<Display {...props} expression="12345678901234" />)
    expect(screen.getByLabelText('result')).toHaveAttribute('data-density', 'dense')

    rerender(<Display {...props} expression="1234567890123456789" />)
    expect(screen.getByLabelText('result')).toHaveAttribute('data-density', 'ultra')
  })

  it('renders parser square-root syntax as mathematical notation', () => {
    render(
      <Display
        expression="sqrt(9)"
        pendingClosingParentheses={0}
        submittedExpression={null}
        error={null}
        warning={null}
        loading={false}
      />,
    )

    expect(screen.getByLabelText('result')).toHaveTextContent('√(9)')
    expect(screen.getByLabelText('result')).not.toHaveTextContent('sqrt')
  })

  it('keeps parser syntax hidden while marking an error', () => {
    const { container } = render(
      <Display
        expression="sqrt(9)+)"
        pendingClosingParentheses={0}
        submittedExpression={null}
        error={{ code: 'SYNTAX_ERROR', message: 'Check the expression', position: 8 }}
        warning={null}
        loading={false}
      />,
    )

    expect(screen.getByLabelText('result')).toHaveTextContent('√(9)+)')
    expect(screen.getByLabelText('result')).not.toHaveTextContent('sqrt')
    expect(container.querySelector('[data-fault]')).toHaveTextContent(')')
  })

  it('formats parser syntax before an unexpected-end caret', () => {
    const { container } = render(
      <Display
        expression="sqrt("
        pendingClosingParentheses={1}
        submittedExpression={null}
        error={{ code: 'SYNTAX_ERROR', message: 'Check the expression', position: 5 }}
        warning={null}
        loading={false}
      />,
    )

    expect(screen.getByLabelText('result')).toHaveTextContent('√(')
    expect(screen.getByLabelText('result')).not.toHaveTextContent('sqrt')
    expect(container.querySelector('[data-fault]')).toHaveClass('fault--caret')
  })

  it('uses scientific notation only when a completed result exceeds the readout width', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.classList.contains('display__readout') ? 320 : 0
      },
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.classList.contains('display__measure') ? 620 : 0
      return { width, height: 0, top: 0, right: width, bottom: 0, left: 0, x: 0, y: 0, toJSON() {} }
    })

    render(
      <Display
        expression="9000000000000000000"
        pendingClosingParentheses={0}
        submittedExpression="900000000000000000×10"
        error={null}
        warning={null}
        loading={false}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText('result')).toHaveTextContent('9e18'))
    expect(screen.getByLabelText('result')).toHaveAttribute(
      'aria-description',
      'Full result: 9000000000000000000',
    )
  })

  it('renders inferred closing parentheses as a muted visual preview', () => {
    const { container } = render(
      <Display
        expression="((2+3"
        pendingClosingParentheses={2}
        submittedExpression={null}
        error={null}
        warning={null}
        loading={false}
      />,
    )

    expect(container.querySelector('.display__ghost-parenthesis')).toHaveTextContent('))')
    expect(screen.getByLabelText('result')).toHaveAttribute(
      'aria-description',
      '2 closing parentheses will be added automatically',
    )
  })
})
