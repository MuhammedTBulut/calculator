import { useEffect, useRef } from 'react'
import type { CalculatorApi } from './api/client'
import { useCalculator } from './hooks/useCalculator'
import { Display } from './components/Display'
import { Keypad } from './components/Keypad'
import { HistoryPanel } from './components/HistoryPanel'

interface AppProps {
  api: CalculatorApi
}

/** Wires the hook to the presentational components; owns no state itself. */
function App({ api }: AppProps) {
  const calc = useCalculator(api)
  const { handleKey } = calc
  const calcRef = useRef<HTMLElement>(null)

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
      if (handleKey(e.key)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  return (
    <div className="bench">
      <main className="calc" aria-label="calculator" ref={calcRef}>
        <h1 className="calc__nameplate">Calculator</h1>
        <Display expression={calc.expression} error={calc.error} loading={calc.loading} />
        {calc.canRetry && (
          <button type="button" className="retry" onClick={calc.submit}>
            Retry
          </button>
        )}
        <Keypad
          onInput={calc.append}
          onSubmit={calc.submit}
          onDelete={calc.deleteLast}
          onClear={calc.clear}
        />
      </main>
      <HistoryPanel history={calc.history} onRecall={calc.recall} />
    </div>
  )
}

export default App
