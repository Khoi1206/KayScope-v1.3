import { describe, it, expect } from 'vitest'
import { generateFlowSpec } from '../flow-playwright'
import { emptyScopes } from '@/core/interpolation/scope'
import type { FlowNode, FlowEdge } from '@/db/schema/flows'

function node(id: string, data: FlowNode['data']): FlowNode {
  return { id, type: 'action', position: { x: 0, y: 0 }, data }
}

describe('generateFlowSpec — selector override precedence', () => {
  it('falls back to text matching with .first() when no override is set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_text', label: 'Click', text: 'Sign in' })],
      edges: [],
    })
    expect(spec).toContain('page.getByText(`Sign in`).first().click()')
  })

  it('uses getByTestId and drops .first() when testId is set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_text', label: 'Click', text: 'Sign in', testId: 'signin-btn' })],
      edges: [],
    })
    expect(spec).toContain('page.getByTestId(`signin-btn`).click()')
    expect(spec).not.toContain('.first()')
  })

  it('uses a CSS locator when selector is set and testId is not', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_text', label: 'Click', text: 'Sign in', selector: '.btn-primary' })],
      edges: [],
    })
    expect(spec).toContain('page.locator(`.btn-primary`).click()')
  })

  it('prefers testId over selector when both are set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_text', label: 'Click', text: 'Sign in', testId: 'signin-btn', selector: '.btn-primary' })],
      edges: [],
    })
    expect(spec).toContain('page.getByTestId(`signin-btn`)')
    expect(spec).not.toContain('.btn-primary')
  })

  it('applies the override to non-text-based node types too (click_role)', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_role', label: 'Click', role: 'button', roleName: 'Submit', testId: 'submit-btn' })],
      edges: [],
    })
    expect(spec).toContain('page.getByTestId(`submit-btn`).click()')
    expect(spec).not.toContain('getByRole')
  })
})

describe('generateFlowSpec — {{variable}} interpolation', () => {
  it('resolves variables from the environment scope in node fields', () => {
    const scopes = { ...emptyScopes(), environment: { base_url: 'https://example.com' } }
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'navigate', label: 'Go', url: '{{base_url}}/login' })],
      edges: [],
      scopes,
    })
    expect(spec).toContain('page.goto(`https://example.com/login`)')
  })

  it('resolves variables from the global scope', () => {
    const scopes = { ...emptyScopes(), global: { username: 'alice' } }
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'fill_label', label: 'Fill', labelText: 'Username', value: '{{username}}' })],
      edges: [],
      scopes,
    })
    expect(spec).toContain('.fill(`alice`)')
  })

  it('leaves unresolved variables untouched (never silently empty)', () => {
    const scopes = emptyScopes()
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'navigate', label: 'Go', url: '{{missing_var}}/login' })],
      edges: [],
      scopes,
    })
    expect(spec).toContain('page.goto(`{{missing_var}}/login`)')
  })

  it('does not interpolate when no scopes are provided (raw tokens pass through)', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'navigate', label: 'Go', url: '{{base_url}}/login' })],
      edges: [],
    })
    expect(spec).toContain('page.goto(`{{base_url}}/login`)')
  })

  it('interpolates conditional-branch condition text', () => {
    const scopes = { ...emptyScopes(), environment: { banner_text: 'Welcome back' } }
    const nodes: FlowNode[] = [
      node('a', { type: 'navigate', label: 'Go', url: 'https://example.com' }),
      node('b', { type: 'click_text', label: 'Dismiss', text: 'OK' }),
      node('c', { type: 'screenshot', label: 'Shot' }),
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b', data: { condition: 'if_visible', conditionText: '{{banner_text}}' } },
      { id: 'e2', source: 'a', target: 'c', data: { condition: 'if_not_visible' } },
    ]
    const spec = generateFlowSpec({ name: 'Flow', nodes, edges, scopes })
    expect(spec).toContain('if (await page.getByText(`Welcome back`).isVisible())')
  })
})

describe('generateFlowSpec — new action node types', () => {
  it('press_key: presses on the page when no focus target is set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'press_key', label: 'Press', key: 'Enter' })],
      edges: [],
    })
    expect(spec).toContain('await page.keyboard.press(`Enter`)')
  })

  it('press_key: presses on a target locator when focus text is set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'press_key', label: 'Press', key: 'Tab', text: 'Username' })],
      edges: [],
    })
    expect(spec).toContain('page.getByText(`Username`).first().press(`Tab`)')
  })

  it('handle_dialog: accept without prompt text', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'handle_dialog', label: 'Dialog', dialogAction: 'accept' })],
      edges: [],
    })
    expect(spec).toContain("page.once('dialog', dialog => dialog.accept())")
  })

  it('handle_dialog: accept with prompt text', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'handle_dialog', label: 'Dialog', dialogAction: 'accept', promptText: 'my answer' })],
      edges: [],
    })
    expect(spec).toContain("dialog.accept(`my answer`)")
  })

  it('handle_dialog: dismiss ignores prompt text', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'handle_dialog', label: 'Dialog', dialogAction: 'dismiss', promptText: 'ignored' })],
      edges: [],
    })
    expect(spec).toContain("dialog.dismiss()")
  })

  it('upload_file: defaults to input[type=file] with .first() when no override', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'upload_file', label: 'Upload', filePath: 'tests/e2e/fixtures/sample.pdf' })],
      edges: [],
    })
    expect(spec).toContain(`page.locator('input[type="file"]').first().setInputFiles(\`tests/e2e/fixtures/sample.pdf\`)`)
  })

  it('upload_file: uses testId override when set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'upload_file', label: 'Upload', filePath: 'a.pdf', testId: 'file-input' })],
      edges: [],
    })
    expect(spec).toContain('page.getByTestId(`file-input`).setInputFiles(`a.pdf`)')
  })

  it('drag_drop: emits dragTo with the target CSS selector', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'drag_drop', label: 'Drag', text: 'Card 1', targetSelector: '#drop-zone' })],
      edges: [],
    })
    expect(spec).toContain('await page.getByText(`Card 1`).first().dragTo(page.locator(`#drop-zone`))')
  })

  it('click_new_tab: emits Promise.all + context.waitForEvent, and descendants use the new page var', () => {
    const nodes: FlowNode[] = [
      node('a', { type: 'click_new_tab', label: 'Open', text: 'Open in new tab' }),
      node('b', { type: 'click_text', label: 'Click on new tab', text: 'Continue' }),
    ]
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'b' }]
    const spec = generateFlowSpec({ name: 'Flow', nodes, edges })

    expect(spec).toContain('async ({ page, context }) => {')
    expect(spec).toContain('const [page1] = await Promise.all([')
    expect(spec).toContain("context.waitForEvent('page'),")
    expect(spec).toContain('page.getByText(`Open in new tab`).first().click(),')
    expect(spec).toContain('await page1.waitForLoadState()')
    expect(spec).toContain('page1.getByText(`Continue`).first().click()')
  })

  it('assert_api_response: waits for a matching response without asserting status when none is set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'assert_api_response', label: 'Wait for checkout call', apiUrlPattern: '/api/checkout' })],
      edges: [],
    })
    expect(spec).toContain('const response = await page.waitForResponse(resp => new RegExp(`/api/checkout`).test(resp.url()), { timeout: 15_000 })')
    expect(spec).not.toContain('response.status()')
  })

  it('assert_api_response: asserts the response status when apiExpectedStatus is set', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'assert_api_response', label: 'Checkout succeeds', apiUrlPattern: '/api/checkout', apiExpectedStatus: 200 })],
      edges: [],
    })
    expect(spec).toContain('await expect(response.status()).toBe(200)')
  })

  it('assert_api_response: resolves {{variable}} tokens in the URL pattern', () => {
    const scopes = { ...emptyScopes(), environment: { api_path: '/api/orders' } }
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'assert_api_response', label: 'Orders call', apiUrlPattern: '{{api_path}}', apiExpectedStatus: 201 })],
      edges: [],
      scopes,
    })
    expect(spec).toContain('new RegExp(`/api/orders`).test(resp.url())')
  })

  it('frameSelector: scopes the locator through page.frameLocator()', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_text', label: 'Click', text: 'Submit', frameSelector: 'iframe#checkout' })],
      edges: [],
    })
    expect(spec).toContain('page.frameLocator(`iframe#checkout`).getByText(`Submit`).first().click()')
  })

  it('frameSelector combined with testId override scopes getByTestId through the frame', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'click_text', label: 'Click', frameSelector: 'iframe#checkout', testId: 'pay-btn' })],
      edges: [],
    })
    expect(spec).toContain('page.frameLocator(`iframe#checkout`).getByTestId(`pay-btn`).click()')
  })

  it('does not scope page-level calls (goto) through frameSelector', () => {
    const spec = generateFlowSpec({
      name: 'Flow',
      nodes: [node('a', { type: 'navigate', label: 'Go', url: 'https://example.com', frameSelector: 'iframe#unused' })],
      edges: [],
    })
    expect(spec).toContain('await page.goto(`https://example.com`)')
    expect(spec).not.toContain('frameLocator')
  })
})

describe('generateFlowSpec — validation', () => {
  it('throws when the flow has no nodes', () => {
    expect(() => generateFlowSpec({ name: 'Flow', nodes: [], edges: [] })).toThrow('Flow has no nodes')
  })

  it('throws on a direct cycle (a -> b -> a)', () => {
    const nodes: FlowNode[] = [
      node('a', { type: 'navigate', label: 'A', url: 'https://example.com' }),
      node('b', { type: 'click_text', label: 'B', text: 'X' }),
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ]
    expect(() => generateFlowSpec({ name: 'Flow', nodes, edges })).toThrow('Flow contains a cycle')
  })

  it('throws on a self-loop', () => {
    const nodes: FlowNode[] = [node('a', { type: 'navigate', label: 'A', url: 'https://example.com' })]
    const edges: FlowEdge[] = [{ id: 'e1', source: 'a', target: 'a' }]
    expect(() => generateFlowSpec({ name: 'Flow', nodes, edges })).toThrow('Flow contains a cycle')
  })

  it('throws on a longer cycle (a -> b -> c -> a)', () => {
    const nodes: FlowNode[] = [
      node('a', { type: 'navigate', label: 'A', url: 'https://example.com' }),
      node('b', { type: 'click_text', label: 'B', text: 'X' }),
      node('c', { type: 'wait_ms', label: 'C', ms: 100 }),
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'c', target: 'a' },
    ]
    expect(() => generateFlowSpec({ name: 'Flow', nodes, edges })).toThrow('Flow contains a cycle')
  })

  it('does not throw for a diamond shape that reconverges without a cycle', () => {
    const nodes: FlowNode[] = [
      node('a', { type: 'navigate', label: 'A', url: 'https://example.com' }),
      node('b', { type: 'click_text', label: 'B', text: 'X' }),
      node('c', { type: 'wait_ms', label: 'C', ms: 100 }),
      node('d', { type: 'screenshot', label: 'D' }),
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b', data: { condition: 'if_visible', conditionText: 'X' } },
      { id: 'e2', source: 'a', target: 'c', data: { condition: 'if_not_visible' } },
      { id: 'e3', source: 'b', target: 'd' },
    ]
    expect(() => generateFlowSpec({ name: 'Flow', nodes, edges })).not.toThrow()
  })

  it('throws when a node has more than 2 outgoing edges', () => {
    const nodes: FlowNode[] = [
      node('a', { type: 'navigate', label: 'Root', url: 'https://example.com' }),
      node('b', { type: 'wait_ms', label: 'B', ms: 100 }),
      node('c', { type: 'wait_ms', label: 'C', ms: 100 }),
      node('d', { type: 'wait_ms', label: 'D', ms: 100 }),
    ]
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'c' },
      { id: 'e3', source: 'a', target: 'd' },
    ]
    expect(() => generateFlowSpec({ name: 'Flow', nodes, edges })).toThrow('more than 2 outgoing edges')
  })

  it('throws for an unrecognized node type instead of emitting a silent no-op', () => {
    const nodes: FlowNode[] = [
      // Cast needed: simulates stale data with a NodeType value that no longer exists
      node('a', { type: 'some_removed_type' as FlowNode['data']['type'], label: 'Ghost step' }),
    ]
    expect(() => generateFlowSpec({ name: 'Flow', nodes, edges: [] })).toThrow(/Unsupported node type/)
  })
})
