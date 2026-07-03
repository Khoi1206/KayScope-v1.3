import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { createId } from '../utils'

export type WorkspaceRole = 'admin' | 'editor' | 'viewer'

// Membership rows exist only for non-owner collaborators — the workspace owner
// always has implicit full access (see getEffectiveRole in workspace-guard.ts)
// and is never represented as a row in this table.
export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<WorkspaceRole>().notNull(),
  invitedBy: text('invited_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueMember: unique().on(t.workspaceId, t.userId),
}))

export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
