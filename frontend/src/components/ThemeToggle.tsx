import type { Theme } from '../theme/theme'
import { MoonIcon } from '@phosphor-icons/react/dist/csr/Moon'
import { SunIcon } from '@phosphor-icons/react/dist/csr/Sun'

interface ThemeToggleProps {
  theme: Theme
  onChange(theme: Theme): void
}

/** ThemeToggle is an icon-led two-state appearance switch. */
export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  const nextTheme: Theme = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label="Dark mode"
      title={`Switch to ${nextTheme} mode`}
      onClick={() => onChange(nextTheme)}
    >
      <span className="theme-toggle__thumb" aria-hidden="true" />
      <span className="theme-toggle__option theme-toggle__option--light" aria-hidden="true">
        <SunIcon size={18} weight={theme === 'light' ? 'fill' : 'regular'} />
      </span>
      <span className="theme-toggle__option theme-toggle__option--dark" aria-hidden="true">
        <MoonIcon size={17} weight={theme === 'dark' ? 'fill' : 'bold'} />
      </span>
    </button>
  )
}
