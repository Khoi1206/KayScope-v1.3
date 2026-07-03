import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { environments } from './environments'
import { createId } from '../utils'

// ── Node / Edge types stored in JSONB ────────────────────────────────────────

export type NodeType =
  | 'navigate'
  | 'click_text' | 'click_role' | 'click_placeholder' | 'click_title' | 'hover_text'
  | 'fill_placeholder' | 'fill_label' | 'select_option'
  | 'assert_url' | 'assert_visible' | 'assert_not_visible' | 'assert_value' | 'assert_api_response'
  | 'wait_ms' | 'wait_selector'
  | 'screenshot'
  | 'press_key' | 'handle_dialog' | 'upload_file' | 'drag_drop' | 'click_new_tab'

export interface FlowNodeData {
  type: NodeType
  label: string
  url?: string
  text?: string
  role?: 'button' | 'link' | 'menuitem' | 'tab' | 'checkbox' | 'radio' | 'option' | 'heading'
  roleName?: string
  placeholder?: string
  value?: string
  labelText?: string
  pattern?: string
  ms?: number
  screenshotName?: string
  title?: string
  option?: string
  /** Overrides the native strategy above: page.getByTestId(testId). Takes priority over `selector`. */
  testId?: string
  /** Overrides the native strategy above: page.locator(selector). Used when `testId` is not set. */
  selector?: string
  /** Scopes locator calls through page.frameLocator(frameSelector). Not applicable to page-level nodes. */
  frameSelector?: string
  /** press_key: e.g. 'Enter', 'Tab', 'Control+A'. */
  key?: string
  /** handle_dialog: registers a one-shot page.once('dialog', ...) handler. */
  dialogAction?: 'accept' | 'dismiss'
  /** handle_dialog: text to enter when accepting a window.prompt() dialog. */
  promptText?: string
  /** upload_file: path resolved relative to the project root (flows run server-side). */
  filePath?: string
  /** drag_drop: CSS selector for the drop target. */
  targetSelector?: string
  /** assert_api_response: regex tested against the matched response's URL (page.waitForResponse). */
  apiUrlPattern?: string
  /** assert_api_response: expected HTTP status. When unset, only waits for a matching response without asserting status. */
  apiExpectedStatus?: number
}

export interface FlowNode {
  id: string
  type: 'action'
  position: { x: number; y: number }
  data: FlowNodeData
}

export interface FlowEdgeData {
  condition: 'always' | 'if_visible' | 'if_not_visible'
  conditionText?: string
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
  data?: FlowEdgeData
}

// ── Table ─────────────────────────────────────────────────────────────────────

export type FlowBrowser = 'chromium' | 'firefox' | 'webkit'

export const flows = pgTable('flows', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  nodes: jsonb('nodes').$type<FlowNode[]>().notNull().default([]),
  edges: jsonb('edges').$type<FlowEdge[]>().notNull().default([]),
  browsers: jsonb('browsers').$type<FlowBrowser[]>().notNull().default(['chromium']),
  // Optional binding to an environment — supplies environment + workspace global
  // variables for {{variable}} interpolation in node fields at run time.
  environmentId: text('environment_id').references(() => environments.id, { onDelete: 'set null' }),
  // Run timeout in milliseconds — how long `POST /api/flows/[id]/run` waits for
  // the Playwright CLI before killing it. Defaults to 120s when unset.
  timeoutMs: integer('timeout_ms').notNull().default(120_000),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Flow = typeof flows.$inferSelect
export type NewFlow = typeof flows.$inferInsert
