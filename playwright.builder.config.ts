import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // PLAYWRIGHT_TEST_DIR is set per-run by the flow runner to isolate concurrent executions.
  // Falls back to the shared generated/ directory for manual / CI use.
  testDir: process.env.PLAYWRIGHT_TEST_DIR ?? 'tests/e2e/generated',
  timeout: 30_000,
  retries: 0,
  reporter: [['json']],
  workers: 1,
  use: {
    baseURL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // Each flow stores which browser engine to run against; the flow runner
  // selects one of these via `--project=<name>`.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
