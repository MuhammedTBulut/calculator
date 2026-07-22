import { describe, expect, it } from 'vitest'
import { BrowserThemePreferenceStore } from './theme'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('BrowserThemePreferenceStore', () => {
  it('persists a valid theme through the storage boundary', () => {
    const store = new BrowserThemePreferenceStore(new MemoryStorage())

    store.write('dark')

    expect(store.read()).toBe('dark')
  })

  it('rejects unknown persisted values', () => {
    const storage = new MemoryStorage()
    storage.setItem('sezzle-calculator-theme', 'purple')

    expect(new BrowserThemePreferenceStore(storage).read()).toBeNull()
  })
})
