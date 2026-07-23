import { useEffect, useState } from 'react'
import App from './App'
import type { CalculatorApi } from './api/client'
import type { ThemePreferenceStore } from './theme/theme'

interface BootstrapProps {
  api: CalculatorApi
  themeStore: ThemePreferenceStore
  waitUntilReady(signal: AbortSignal): Promise<void>
}

/** Holds back the interactive calculator until its backend is available. */
export function Bootstrap({ api, themeStore, waitUntilReady }: BootstrapProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void waitUntilReady(controller.signal).then(() => {
      if (!controller.signal.aborted) {
        setReady(true)
      }
    }).catch(() => {
      // Availability failures are retried inside the adapter; abort means unmount.
    })
    return () => controller.abort()
  }, [waitUntilReady])

  if (!ready) {
    return (
      <main className="startup" aria-busy="true" aria-live="polite">
        <img className="startup__logo" src="/sezzle-logo.svg" alt="Sezzle" />
        <div className="startup__spinner" aria-hidden="true" />
        <p className="startup__status">Calculator is getting ready…</p>
      </main>
    )
  }

  return <App api={api} themeStore={themeStore} />
}
