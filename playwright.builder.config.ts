import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // PLAYWRIGHT_TEST_DIR is set per-run by the flow runner to isolate concurrent executions.
  // Falls back to the shared generated/ directory for manual / CI use.
  testDir: process.env.PLAYWRIGHT_TEST_DIR ?? 'tests/e2e/generated',
  // PLAYWRIGHT_OUTPUT_DIR is set per-run so screenshots/videos from concurrent runs
  // don't overwrite each other, and so the run route can locate them by run id afterward.
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'test-results',
  timeout: 30_000,
  retries: 0,
  reporter: [['json']],
  workers: 1,
  use: {
    baseURL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    // 'retain-on-failure' records every test but deletes the video for ones that
    // pass — same failure-only intent as `screenshot`, without paying for videos
    // of passing runs.
    video: 'retain-on-failure',
    // Trace viewer archive (steps, DOM snapshots, network) — richer than a
    // screenshot/video alone for figuring out *why* a step failed. Same
    // failure-only retention policy as the other two.
    trace: 'retain-on-failure',
  },
  // Each flow stores which browser engine to run against; the flow runner
  // selects one of these via `--project=<name>`.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
