import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { flows, type FlowNode, type FlowEdge } from './flows'
import { users } from './users'
import { createId } from '../utils'

// A version is a manual snapshot of a flow's canvas (nodes + edges) at a point
// in time — created via "Save Version" in the editor, restorable later. Unlike
// flow_runs (execution history), this is purely a canvas-content checkpoint;
// there is no automatic snapshotting on every autosave (that would be too noisy
// to be useful as a restore point).
export const flowVersions = pgTable('flow_versions', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  flowId: text('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
  // Optional user-provided label, e.g. "Before checkout redesign". Falls back to a timestamp in the UI when empty.
  label: text('label'),
  nodes: jsonb('nodes').$type<FlowNode[]>().notNull(),
  edges: jsonb('edges').$type<FlowEdge[]>().notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FlowVersion = typeof flowVersions.$inferSelect
export type NewFlowVersion = typeof flowVersions.$inferInsert
