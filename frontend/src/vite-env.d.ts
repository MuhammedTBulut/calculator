/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the calculator API; defaults to /api/v1 (nginx proxy path). */
  readonly VITE_API_BASE_URL?: string
}
