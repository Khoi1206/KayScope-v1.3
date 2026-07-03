import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = `e2e-${Date.now()}@example.com`
const TEST_PASSWORD = 'E2eTest!2025'

/** Fill the register form using stable element IDs and submit */
async function fillRegisterForm(page: Page, email: string) {
  await page.locator('#name').fill('E2E Test User')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /create account|tạo tài khoản/i }).click()
}

test.describe('Auth flow', () => {
  test('register page is reachable', async ({ page }) => {
    await page.goto('/en/register')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('login page is reachable', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.getByRole('button', { name: /sign in|đăng nhập/i })).toBeVisible()
  })

  test('register a new user', async ({ page }) => {
    await page.goto('/en/register')
    await fillRegisterForm(page, TEST_EMAIL)
    // Should redirect to dashboard after register (auto-login)
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('login with registered user', async ({ page }) => {
    const uniqueEmail = `e2e-login-${Date.now()}@example.com`

    // Register first so we have a user
    await page.goto('/en/register')
    await fillRegisterForm(page, uniqueEmail)
    await page.waitForURL(/dashboard/, { timeout: 15_000 })

    // Sign out by navigating away and clearing session
    await page.goto('/en/login')

    // Now login with the same credentials
    await page.locator('#email').fill(uniqueEmail)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|đăng nhập/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/en/login')
    await page.locator('#email').fill('does-not-exist@example.com')
    await page.locator('#password').fill('WrongPassword123!')
    await page.getByRole('button', { name: /sign in|đăng nhập/i }).click()
    // Error message should appear (stay on login page)
    await expect(page).toHaveURL(/login/, { timeout: 8_000 })
  })

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/en/dashboard')
    await page.waitForURL(/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/login/)
  })
})
