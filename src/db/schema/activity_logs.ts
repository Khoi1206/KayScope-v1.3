import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { createId } from '../utils'

export type ActivityAction = 'created' | 'deleted' | 'renamed' | 'updated'
export type ActivityEntityType = 'collection' | 'folder' | 'request' | 'environment' | 'flow' | 'member'

// A lightweight audit trail of who did what, when — logged only for low-frequency,
// high-signal actions (create/delete/rename of top-level entities, membership
// changes). Not a generic event bus: no logging of every field-level update, since
// most entities already have their own content-versioning story where that matters
// (e.g. request_versions, flow_versions).
export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').$type<ActivityAction>().notNull(),
  entityType: text('entity_type').$type<ActivityEntityType>().notNull(),
  entityId: text('entity_id').notNull(),
  // Snapshot of the entity's name at log time — survives later renames/deletes so
  // the log entry still reads sensibly.
  entityName: text('entity_name').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ActivityLog = typeof activityLogs.$inferSelect
export type NewActivityLog = typeof activityLogs.$inferInsert
