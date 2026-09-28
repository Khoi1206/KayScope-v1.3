import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Same .env the app reads — the e2e auth helper needs ADMIN_EMAIL / ADMIN_PASSWORD.
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: 'tests/e2e/ui',
  globalSetup: './tests/e2e/ui/global-setup.ts',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  // Sequential — tests share a live dev server and database
  workers: 1,
  use: {
    baseURL: 'http://localhost:3008',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3008',
    // Reuse a server that's already running (typical during local dev)
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
