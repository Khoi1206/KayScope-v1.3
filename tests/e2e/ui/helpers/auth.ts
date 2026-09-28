import type { Page } from '@playwright/test'

// Self-registration is disabled (Admin CMS) — accounts can only be created by
// an existing admin. The bootstrap admin is seeded once on server startup
// from ADMIN_EMAIL / ADMIN_PASSWORD (see src/lib/auth/seed-admin.ts);
// playwright.config.ts loads them from .env.
export const TEST_USER_PASSWORD = 'E2eTest!2025'

function adminCredentials(): { email: string; password: string } {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD must be set in .env to run e2e tests')
  }
  return { email, password }
}

/**
 * Logs in via the NextAuth credentials callback directly (CSRF token + POST),
 * bypassing the UI form. Sets the session cookie on the page's browser
 * context, so a subsequent `page.goto()` is already authenticated.
 */
export async function apiLogin(page: Page, email: string, password: string): Promise<void> {
  const csrfRes = await page.request.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()
  // maxRedirects: 0 — the callback responds with a 302 to the app root; we only
  // need the Set-Cookie header, not the full page it would otherwise fetch and render.
  await page.request.post('/api/auth/callback/credentials', {
    form: { email, password, csrfToken, redirect: 'false', json: 'true' },
    maxRedirects: 0,
  })
}

/**
 * Creates a fresh regular user via the admin CMS API and returns its
 * credentials. Requires logging in as the seeded admin first (self-service
 * registration is disabled), so this leaves the page's session as the admin
 * — call `apiLogin` again to switch to the new user.
 */
export async function createTestUser(
  page: Page,
  opts: { isAdmin?: boolean } = {}
): Promise<{ email: string; password: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const admin = adminCredentials()
  await apiLogin(page, admin.email, admin.password)
  const res = await page.request.post('/api/admin/users', {
    data: {
      name: 'E2E Test User',
      email,
      password: TEST_USER_PASSWORD,
      isAdmin: opts.isAdmin ?? false,
      isActive: true,
    },
  })
  if (!res.ok()) {
    throw new Error(`Failed to create test user via admin API: ${res.status()} ${await res.text()}`)
  }
  return { email, password: TEST_USER_PASSWORD }
}

/**
 * Waits until the NextAuth CSRF cookie is present in the page's browser
 * context. The login form fetches its own CSRF token on submit, but a
 * click fired immediately after `page.goto()` can race that fetch —
 * polling for the cookie (rather than a fixed sleep) waits exactly as long
 * as needed and no longer.
 */
export async function waitForCsrfCookie(page: Page): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const cookies = await page.context().cookies()
    if (cookies.some(c => c.name === 'authjs.csrf-token')) return
    await page.waitForTimeout(100)
  }
}

/** Creates a brand-new regular user, logs in as them, and lands on the dashboard. */
export async function loginAsNewUser(page: Page): Promise<string> {
  const { email, password } = await createTestUser(page)
  await apiLogin(page, email, password)
  await page.goto('/en/dashboard')
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
  return email
}
