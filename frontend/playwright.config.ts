import { defineConfig, devices } from '@playwright/test'

const frontendUrl = 'http://127.0.0.1:43917'
const backendUrl = 'http://127.0.0.1:43918'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      name: 'backend',
      command: 'go run ./cmd/server',
      cwd: '../backend',
      url: `${backendUrl}/health`,
      env: {
        PORT: '43918',
        CORS_ORIGIN: frontendUrl,
        RATE_LIMIT_PER_MINUTE: '6000',
        RATE_LIMIT_BURST: '100',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: 'frontend',
      command: 'npm run dev -- --host 127.0.0.1 --port 43917',
      url: frontendUrl,
      env: { VITE_PROXY_TARGET: backendUrl },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
