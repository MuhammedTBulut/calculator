import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Without vitest globals, Testing Library cannot auto-register its cleanup.
afterEach(() => cleanup())

// jsdom mimics a browser's native "uncaught exception" reporting for any
// error that escapes a DOM event dispatch — including a React render error
// on its way up to an ErrorBoundary, before the boundary's own catch fully
// absorbs it. That log goes through jsdom's virtual console, a channel
// mocking console.error in a test's beforeEach does not reach (it was bound
// before the mock existed), so ErrorBoundary tests print a raw stack trace
// even though nothing failed. preventDefault() on the window error event
// is the spec-compliant way to suppress a browser's default action for it.
window.addEventListener('error', (event) => {
  event.preventDefault()
})
