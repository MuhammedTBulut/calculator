import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Bootstrap } from './Bootstrap.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { HttpCalculatorApi, waitForBackend } from './api/client.ts'
import { BrowserThemePreferenceStore } from './theme/theme.ts'

// Composition root: concrete API and persistence adapters are constructed here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Bootstrap
        api={new HttpCalculatorApi()}
        themeStore={new BrowserThemePreferenceStore()}
        waitUntilReady={waitForBackend}
      />
    </ErrorBoundary>
  </StrictMode>,
)
