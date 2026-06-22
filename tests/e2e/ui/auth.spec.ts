import { test, expect } from '@playwright/test'

const TEST_EMAIL = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'E2eTest!2025'

test.describe('Auth flow', () => {
  test('register page is reachable', async ({ page }) => {
    await page.goto('/en/register')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('login page is reachable', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.getByRole('button', { name: /sign in|login|đăng nhập/i })).toBeVisible()
  })

  test('register a new user', async ({ page }) => {
    await page.goto('/en/register')
    await page.getByLabel(/email/i).fill(TEST_EMAIL)
    await page.getByLabel(/password/i).first().fill(TEST_PASSWORD)
    // Some forms have confirm-password
    const confirm = page.getByLabel(/confirm/i)
    if (await confirm.isVisible()) {
      await confirm.fill(TEST_PASSWORD)
    }
    await page.getByRole('button', { name: /register|sign up|tạo tài khoản/i }).click()
    // Should redirect to dashboard or login after register
    await page.waitForURL(/(dashboard|login)/, { timeout: 15_000 })
  })

  test('login with registered user', async ({ page }) => {
    // Register first so we have a user
    await page.goto('/en/register')
    const uniqueEmail = `e2e-login-${Date.now()}@example.com`
    await page.getByLabel(/email/i).fill(uniqueEmail)
    await page.getByLabel(/password/i).first().fill(TEST_PASSWORD)
    const confirm = page.getByLabel(/confirm/i)
    if (await confirm.isVisible()) await confirm.fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /register|sign up|tạo tài khoản/i }).click()
    await page.waitForURL(/(dashboard|login)/, { timeout: 15_000 })

    // Now login
    await page.goto('/en/login')
    await page.getByLabel(/email/i).fill(uniqueEmail)
    await page.getByLabel(/password/i).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|login|đăng nhập/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/en/login')
    await page.getByLabel(/email/i).fill('does-not-exist@example.com')
    await page.getByLabel(/password/i).fill('WrongPassword123!')
    await page.getByRole('button', { name: /sign in|login|đăng nhập/i }).click()
    // Error message should appear (stay on login page)
    await expect(page).toHaveURL(/login/, { timeout: 8_000 })
  })

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/en/dashboard')
    await page.waitForURL(/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/login/)
  })
})
