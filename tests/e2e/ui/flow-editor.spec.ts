import { test, expect, type Page } from '@playwright/test'

const PASSWORD = 'E2eTest!2025'

/** Register a new user and land on the dashboard. Uses stable element IDs. */
async function registerAndLogin(page: Page): Promise<string> {
  const email = `e2e-flow-${Date.now()}@example.com`
  await page.goto('/en/register')
  await page.locator('#name').fill('E2E Flow Test User')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: /create account|tạo tài khoản/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
  return email
}

/** Opens the Flows nav tab, creates a new flow, and lands in the canvas editor. */
async function createFlow(page: Page, name: string) {
  await page.getByRole('button', { name: 'Flows', exact: true }).click()
  await page.locator('button[title="New Flow"]').click()

  const nameInput = page.locator('input[placeholder="e.g. Login and Checkout"]')
  await nameInput.waitFor({ state: 'visible', timeout: 5_000 })
  await nameInput.fill(name)
  await page.getByRole('button', { name: /^save flow$/i }).click()

  // Editor toolbar shows the flow name once created (sidebar row shows it too, so scope to <main>)
  await expect(page.getByRole('main').getByText(name, { exact: true })).toBeVisible({ timeout: 8_000 })
}

/** Expands a palette group (if not already open) and clicks a node type inside it. */
async function addNode(page: Page, groupName: RegExp, nodeName: string) {
  const group = page.getByRole('button', { name: groupName })
  await group.click()
  await page.getByRole('button', { name: nodeName, exact: true }).click()
}

test.describe('Flow editor canvas', () => {
  test('can create a flow and add a node', async ({ page }) => {
    await registerAndLogin(page)
    await createFlow(page, 'Canvas Basics Flow')

    await addNode(page, /navigation/i, 'Navigate')

    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 8_000 })
    await expect(page.getByText('Properties')).toBeVisible()
  })

  test('duplicate (Ctrl+D) clones the selected node, undo/redo restore it', async ({ page }) => {
    await registerAndLogin(page)
    await createFlow(page, 'Duplicate Undo Flow')
    await addNode(page, /navigation/i, 'Navigate')

    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 8_000 })

    // Node stays selected after adding — Ctrl+D duplicates it
    await page.keyboard.press('Control+d')
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 5_000 })

    // Undo removes the duplicate
    await page.keyboard.press('Control+z')
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 5_000 })

    // Redo brings it back
    await page.keyboard.press('Control+y')
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 5_000 })
  })

  test('search finds a node by label and selects it', async ({ page }) => {
    await registerAndLogin(page)
    await createFlow(page, 'Search Flow')
    await addNode(page, /navigation/i, 'Navigate')
    await addNode(page, /assert/i, 'Assert visible')

    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 8_000 })

    await page.getByRole('button', { name: /^search$/i }).click()
    const searchInput = page.getByPlaceholder('Search nodes by label…')
    await searchInput.fill('Assert')

    // Both the palette item and the search result render "Assert visible" text —
    // scope to the dropdown container (the div holding the search input) to
    // disambiguate from the (still-expanded) palette item of the same name.
    const searchDropdown = page.locator('div').filter({ has: searchInput })
    const result = searchDropdown.getByRole('button', { name: 'Assert visible', exact: true })
    await expect(result).toBeVisible({ timeout: 5_000 })
    await result.click()

    // Selecting a search result opens the properties panel for that node
    await expect(page.getByText('Properties')).toBeVisible()
    await expect(page.locator('input[value="Assert visible"]')).toBeVisible()
  })

  test('flow versions: save current canvas, then restore it', async ({ page }) => {
    await registerAndLogin(page)
    await createFlow(page, 'Versions Flow')
    await addNode(page, /navigation/i, 'Navigate')
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 8_000 })

    // Open the Versions panel and save a snapshot with 1 node
    await page.locator('button[title*="Flow versions"]').click()
    await expect(page.getByText('Flow Versions')).toBeVisible()
    await page.getByRole('button', { name: /save current canvas as version/i }).click()

    const saveModalConfirm = page.getByRole('button', { name: /^save$/i }).last()
    await saveModalConfirm.click()

    // Version now appears in the list with a node count
    await expect(page.getByText('1 nodes').first()).toBeVisible({ timeout: 8_000 })

    // Close the panel, add a second node, then restore the saved version
    await page.keyboard.press('Escape')
    await addNode(page, /assert/i, 'Assert visible')
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 8_000 })

    await page.locator('button[title*="Flow versions"]').click()
    await page.getByRole('button', { name: /^restore$/i }).click()
    await page.getByRole('button', { name: /^restore$/i }).last().click() // confirm modal

    await page.keyboard.press('Escape')
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 8_000 })
  })
})
