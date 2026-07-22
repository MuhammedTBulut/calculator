import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { HttpCalculatorApi } from './api/client.ts'

// Composition root: the one place a concrete CalculatorApi is constructed.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App api={new HttpCalculatorApi()} />
    </ErrorBoundary>
  </StrictMode>,
)
