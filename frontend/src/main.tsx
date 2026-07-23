import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { HttpCalculatorApi, warmBackend } from './api/client.ts'
import { BrowserThemePreferenceStore } from './theme/theme.ts'

warmBackend()

// Composition root: concrete API and persistence adapters are constructed here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App
        api={new HttpCalculatorApi()}
        themeStore={new BrowserThemePreferenceStore()}
      />
    </ErrorBoundary>
  </StrictMode>,
)
