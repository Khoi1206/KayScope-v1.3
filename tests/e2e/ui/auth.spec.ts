import { test, expect } from '@playwright/test'
import { createTestUser, waitForCsrfCookie } from './helpers/auth'

// Self-registration is disabled (Admin CMS) — /register redirects to /login
// and accounts are created only via POST /api/admin/users by an admin.
// See src/app/[locale]/(auth)/register/page.tsx.

test.describe('Auth flow', () => {
  test('register page redirects to login (self-registration disabled)', async ({ page }) => {
    await page.goto('/en/register')
    await page.waitForURL(/\/en\/login/, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /sign in|đăng nhập/i })).toBeVisible()
  })

  test('login page is reachable', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.getByRole('button', { name: /sign in|đăng nhập/i })).toBeVisible()
  })

  test('admin can create a user who can then log in', async ({ page, browser }) => {
    const { email, password } = await createTestUser(page)

    // A brand-new browser context — the admin's session cookies never touch it,
    // just like a real user opening the login page in their own browser.
    const userContext = await browser.newContext()
    const userPage = await userContext.newPage()
    await userPage.goto('/en/login')
    await waitForCsrfCookie(userPage)
    await userPage.locator('#email').fill(email)
    await userPage.locator('#password').fill(password)
    await userPage.getByRole('button', { name: /sign in|đăng nhập/i }).click()
    await userPage.waitForURL(/dashboard/, { timeout: 15_000 })
    await expect(userPage).toHaveURL(/dashboard/)
    await userContext.close()
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/en/login')
    await waitForCsrfCookie(page)
    await page.locator('#email').fill('does-not-exist@example.com')
    await page.locator('#password').fill('WrongPassword123!')
    await page.getByRole('button', { name: /sign in|đăng nhập/i }).click()
    // Error message should appear (stay on login page)
    await expect(page).toHaveURL(/login/, { timeout: 8_000 })
  })

  test('disabled account shows account-disabled error', async ({ page, browser }) => {
    const { email, password } = await createTestUser(page)

    // Deactivate the account we just created, still logged in as admin
    const usersRes = await page.request.get(`/api/admin/users?search=${encodeURIComponent(email)}`)
    const { users } = await usersRes.json()
    const userId = users[0]?.id
    expect(userId).toBeTruthy()
    const patchRes = await page.request.patch(`/api/admin/users/${userId}`, { data: { isActive: false } })
    expect(patchRes.ok()).toBeTruthy()

    const userContext = await browser.newContext()
    const userPage = await userContext.newPage()
    await userPage.goto('/en/login')
    await waitForCsrfCookie(userPage)
    await userPage.locator('#email').fill(email)
    await userPage.locator('#password').fill(password)
    await userPage.getByRole('button', { name: /sign in|đăng nhập/i }).click()
    await expect(userPage).toHaveURL(/login/, { timeout: 8_000 })
    await expect(userPage.getByText(/disabled|vô hiệu|đã bị/i)).toBeVisible({ timeout: 8_000 })
    await userContext.close()
  })

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/en/dashboard')
    await page.waitForURL(/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/login/)
  })
})
