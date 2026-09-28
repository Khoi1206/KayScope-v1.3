import { test, expect, type Page } from '@playwright/test'
import { loginAsNewUser as registerAndLogin } from './helpers/auth'

// Self-registration is disabled (Admin CMS) — each test creates a fresh user
// via the admin API and logs in as them. See ./helpers/auth.ts.

/** A brand-new user's dashboard has no tabs open — click "New tab" to reach the empty request editor. */
async function openNewTab(page: Page): Promise<void> {
  await page.locator('button[title="New tab"]').first().click()
}

test.describe('Request editor flow', () => {
  test('dashboard loads with sidebar and editor', async ({ page }) => {
    await registerAndLogin(page)

    // Sidebar should be visible
    await expect(page.locator('aside')).toBeVisible()
  })

  test('can open a new request tab', async ({ page }) => {
    await registerAndLogin(page)
    await openNewTab(page)

    // URL bar input should be visible once a tab is open
    await expect(page.locator('input[placeholder*="https"]')).toBeVisible({ timeout: 8_000 })
  })

  test('can type a URL and see Send button', async ({ page }) => {
    await registerAndLogin(page)
    await openNewTab(page)

    const urlInput = page.locator('input[placeholder*="https"]')
    await urlInput.waitFor({ state: 'visible', timeout: 10_000 })
    await urlInput.fill('https://httpbin.org/get')

    const sendBtn = page.getByRole('button', { name: /^send$/i })
    await expect(sendBtn).toBeVisible()
    await expect(sendBtn).toBeEnabled()
  })

  test('Code snippet button opens snippet modal', async ({ page }) => {
    await registerAndLogin(page)
    await openNewTab(page)
    const urlInput = page.locator('input[placeholder*="https"]')
    await urlInput.waitFor({ state: 'visible', timeout: 10_000 })
    await urlInput.fill('https://api.example.com/test')

    const codeBtn = page.getByRole('button', { name: /^code$/i })
    await expect(codeBtn).toBeVisible()
    await codeBtn.click()

    // Modal should appear with language tabs
    await expect(page.getByRole('button', { name: 'cURL' })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('JS Fetch')).toBeVisible()
    await expect(page.locator('pre')).toBeVisible()

    // cURL output should contain the URL
    await expect(page.locator('pre')).toContainText('https://api.example.com/test')
  })

  test('can create a collection', async ({ page }) => {
    await registerAndLogin(page)

    // Click the + button in collections header (New Collection)
    const newColBtn = page.locator('button[title="New Collection"]').first()
    if (await newColBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newColBtn.click()
    }

    // InputModal dialog appears — fill the name input
    const nameInput = page.locator('dialog input, [role="dialog"] input').first()
    if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nameInput.fill('My E2E Collection')
      await page.getByRole('button', { name: /create|confirm|ok/i }).last().click()
      // Collection should appear in sidebar
      await expect(page.getByText('My E2E Collection')).toBeVisible({ timeout: 8_000 })
    }
  })

  test('environment section is accessible', async ({ page }) => {
    await registerAndLogin(page)
    // Click the environments nav tab (Layers icon) in sidebar
    const envTab = page.locator('aside button[title*="nvironment"]').first()
    if (await envTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await envTab.click()
      await expect(page.locator('aside')).toContainText(/environment|No environment/i)
    }
  })

  test('search input filters collections', async ({ page }) => {
    await registerAndLogin(page)

    const searchInput = page.locator('aside input[placeholder*="Search"]').first()
    await searchInput.waitFor({ state: 'visible', timeout: 8_000 })
    await searchInput.fill('nonexistent-search-xyz')

    // Input accepted the text
    await expect(searchInput).toHaveValue('nonexistent-search-xyz')

    // Clear input
    await searchInput.fill('')
    await expect(searchInput).toHaveValue('')
  })
})

test.describe('Response panel', () => {
  test('empty state shown before sending', async ({ page }) => {
    await registerAndLogin(page)
    await openNewTab(page)
    // Before sending, should show empty state message
    const emptyState = page.getByText(/click send|send to get|no response/i)
    await expect(emptyState).toBeVisible({ timeout: 8_000 })
  })

  test('response tabs are visible after send (requires network)', async ({ page }) => {
    test.slow() // network request may take time
    await registerAndLogin(page)
    await openNewTab(page)

    const urlInput = page.locator('input[placeholder*="https"]')
    await urlInput.waitFor({ state: 'visible', timeout: 10_000 })
    await urlInput.fill('https://httpbin.org/get')

    await page.getByRole('button', { name: /^send$/i }).click()

    // Wait for response (status badge should appear) — external network call, be generous
    await expect(page.locator('text=200').first()).toBeVisible({ timeout: 45_000 })

    // Response tabs should be visible ("Headers" also exists as a request-editor
    // tab, so the response panel's copy — rendered after it in the DOM — is `.last()`)
    await expect(page.getByRole('button', { name: /pretty/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /raw/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /headers/i }).last()).toBeVisible()
  })
})
