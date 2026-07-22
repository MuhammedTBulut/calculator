import { useEffect } from 'react'
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

  // Keyboard input works anywhere on the page, not only with a focused
  // button; handled keys are consumed so e.g. '/' cannot trigger browser
  // quick-find.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      if (handleKey(e.key)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  return (
    <main>
      <h1>Calculator</h1>
      <Display expression={calc.expression} error={calc.error} loading={calc.loading} />
      {calc.canRetry && (
        <button type="button" onClick={calc.submit}>
          Retry
        </button>
      )}
      <Keypad
        onInput={calc.append}
        onSubmit={calc.submit}
        onDelete={calc.deleteLast}
        onClear={calc.clear}
      />
      <HistoryPanel history={calc.history} onRecall={calc.recall} />
    </main>
  )
}

export default App
