import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Bootstrap } from './Bootstrap'
import type { CalculatorApi } from './api/client'
import type { ThemePreferenceStore } from './theme/theme'

const api: CalculatorApi = {
  evaluate: vi.fn().mockResolvedValue({ ok: true, value: 0 }),
}

const themeStore: ThemePreferenceStore = {
  read: () => 'light',
  write: vi.fn(),
}

describe('Bootstrap', () => {
  it('shows loading and withholds the calculator until the backend is ready', async () => {
    let markReady: (() => void) | undefined
    const waitUntilReady = () => new Promise<void>((resolve) => {
      markReady = resolve
    })

    render(
      <Bootstrap
        api={api}
        themeStore={themeStore}
        waitUntilReady={waitUntilReady}
      />,
    )

    expect(
      screen.getByText(
        'The calculator server is waking up. This can take up to a minute.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('main', { name: 'calculator' })).not.toBeInTheDocument()

    await act(async () => markReady?.())

    expect(screen.getByRole('main', { name: 'calculator' })).toBeInTheDocument()
    expect(
      screen.queryByText(
        'The calculator server is waking up. This can take up to a minute.',
      ),
    ).not.toBeInTheDocument()
  })
})
