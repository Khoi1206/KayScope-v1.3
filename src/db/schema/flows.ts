import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { createId } from '../utils'

// ── Node / Edge types stored in JSONB ────────────────────────────────────────

export type NodeType =
  | 'navigate'
  | 'click_text' | 'click_role' | 'click_placeholder' | 'click_title' | 'hover_text'
  | 'fill_placeholder' | 'fill_label' | 'select_option'
  | 'assert_url' | 'assert_visible' | 'assert_not_visible' | 'assert_value'
  | 'wait_ms' | 'wait_selector'
  | 'screenshot'

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
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Flow = typeof flows.$inferSelect
export type NewFlow = typeof flows.$inferInsert
