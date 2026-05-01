import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e/generated',
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
})
