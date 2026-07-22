import { useEffect, useRef } from 'react'
import type { CalculatorApi } from './api/client'
import { useCalculator } from './hooks/useCalculator'
import { useKeyFeedback } from './hooks/useKeyFeedback'
import { Display } from './components/Display'
import { Keypad } from './components/Keypad'
import { keyNameForKeyboardInput } from './lib/keyboard'
import { HistoryPanel } from './components/HistoryPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { useTheme } from './hooks/useTheme'
import type { ThemePreferenceStore } from './theme/theme'

interface AppProps {
  api: CalculatorApi
  themeStore: ThemePreferenceStore
}

/** Wires application hooks to presentational components and injected adapters. */
function App({ api, themeStore }: AppProps) {
  const calc = useCalculator(api)
  const appearance = useTheme(themeStore)
  const { key: activeKey, sequence: feedbackSequence, pulse: pulseKey } = useKeyFeedback()
  const { handleKey } = calc
  const calcRef = useRef<HTMLElement>(null)
  const handleKeyRef = useRef(handleKey)

  useEffect(() => {
    handleKeyRef.current = handleKey
  }, [handleKey])

  // Typing works when the calculator owns focus or nothing interactive does.
  // Two accessibility rules shape this handler (review checkpoint 4):
  // APG button pattern — a focused control keeps native Enter/Space
  // activation, so those are never intercepted on interactive elements; and
  // WCAG 2.1.4 — printable-character shortcuts stay scoped: with focus in
  // another interactive component (e.g. history), keys are left alone.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      const target = e.target instanceof Element ? e.target : null
      const interactive = target?.closest('button, a, input, select, textarea')
      if (interactive) {
        if (!calcRef.current?.contains(interactive)) {
          return
        }
        if (e.key === 'Enter' || e.key === ' ') {
          return
        }
      }
      if (handleKeyRef.current(e.key)) {
        const keyName = keyNameForKeyboardInput(e.key)
        if (keyName) {
          pulseKey(keyName)
        }
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pulseKey])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img
            className="brand-lockup__logo brand-lockup__logo--light"
            src="/sezzle-logo.svg"
            alt="Sezzle"
          />
          <img
            className="brand-lockup__logo brand-lockup__logo--dark"
            src="/sezzle-logo-white.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="brand-lockup__divider" aria-hidden="true" />
          <span className="brand-lockup__product">Calculator</span>
        </div>
        <h1 className="sr-only">Sezzle Calculator</h1>
        <ThemeToggle theme={appearance.theme} onChange={appearance.setTheme} />
      </header>

      <div className="workspace">
        <main className="calc" aria-label="calculator" aria-busy={calc.loading} ref={calcRef}>
          <Display
            expression={calc.expression}
            pendingClosingParentheses={calc.pendingClosingParentheses}
            submittedExpression={calc.submittedExpression}
            error={calc.error}
            warning={calc.inputWarning}
            loading={calc.loading}
          />

          {calc.canRetry && (
            <button
              type="button"
              className="retry"
              aria-label={calc.retryDelaySeconds > 0
                ? `Retry in ${calc.retryDelaySeconds} ${calc.retryDelaySeconds === 1 ? 'second' : 'seconds'}`
                : 'Retry'}
              disabled={calc.retryDelaySeconds > 0}
              onClick={calc.submit}
            >
              {calc.retryDelaySeconds > 0
                ? `Retry in ${calc.retryDelaySeconds}s`
                : 'Retry calculation'}
            </button>
          )}

          <Keypad
            clearLabel={calc.expression === '' ? 'AC' : 'C'}
            onInput={calc.append}
            onSubmit={calc.submit}
            onDelete={calc.deleteLast}
            onClear={calc.clear}
            onSquareRoot={calc.applySquareRoot}
            onToggleSign={calc.toggleSign}
            activeKey={activeKey}
            feedbackSequence={feedbackSequence}
            onFeedback={pulseKey}
          />
        </main>

        <HistoryPanel history={calc.history} onRecall={calc.recall} />
      </div>
    </div>
  )
}

export default App
