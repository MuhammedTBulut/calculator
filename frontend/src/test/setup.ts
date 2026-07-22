import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Without vitest globals, Testing Library cannot auto-register its cleanup.
afterEach(() => cleanup())
