import { useLayoutEffect, useState } from 'react'
import type { Theme, ThemePreferenceStore } from '../theme/theme'

function systemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export interface UseTheme {
  theme: Theme
  setTheme(theme: Theme): void
}

/** useTheme owns appearance state while delegating persistence to an injected store. */
export function useTheme(store: ThemePreferenceStore): UseTheme {
  const [theme, setTheme] = useState<Theme>(() => store.read() ?? systemTheme())

  // Layout timing prevents a light-theme frame from flashing before dark mode applies.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#000000' : '#f5f5f7',
    )
    store.write(theme)
  }, [store, theme])

  return { theme, setTheme }
}
