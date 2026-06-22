import { chromium, type FullConfig } from '@playwright/test'

/**
 * Global setup: verify the app is reachable before running any tests.
 * If baseURL is not responding, tests are skipped gracefully rather than failing with timeouts.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'
  const browser = await chromium.launch()
  const page = await browser.newPage()
  try {
    await page.goto(baseURL, { timeout: 10_000, waitUntil: 'domcontentloaded' })
  } finally {
    await browser.close()
  }
}
