/** The two visual appearances supported by the application. */
export type Theme = 'light' | 'dark'

/** Persistence boundary used by the theme hook. */
export interface ThemePreferenceStore {
  read(): Theme | null
  write(theme: Theme): void
}

const storageKey = 'sezzle-calculator-theme'

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** BrowserThemePreferenceStore persists appearance without leaking Storage into React. */
export class BrowserThemePreferenceStore implements ThemePreferenceStore {
  private readonly storage: Storage | null

  constructor(storage: Storage | null = browserStorage()) {
    this.storage = storage
  }

  read(): Theme | null {
    try {
      const value = this.storage?.getItem(storageKey)
      return value === 'light' || value === 'dark' ? value : null
    } catch {
      return null
    }
  }

  write(theme: Theme): void {
    try {
      this.storage?.setItem(storageKey, theme)
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }
}
