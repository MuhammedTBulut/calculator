import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

/** Throws on its first render, then renders normally after a reset. */
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('render exploded')
  }
  return <p>calculator works</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors; silence the expected noise so a real
    // unexpected error still stands out in test output.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('calculator works')).toBeInTheDocument()
  })

  it('shows a recoverable fallback instead of a blank screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('calculator works')).not.toBeInTheDocument()
  })

  it('recovers when the user retries and the cause is gone', async () => {
    function Harness() {
      const [broken, setBroken] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setBroken(false)}>
            fix it
          </button>
          <ErrorBoundary>
            <Bomb shouldThrow={broken} />
          </ErrorBoundary>
        </>
      )
    }
    render(<Harness />)
    const user = userEvent.setup()

    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'fix it' }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('calculator works')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
