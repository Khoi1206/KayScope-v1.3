import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { createId } from '../utils'
import type { Variable } from './index'

export const environments = pgTable('environments', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Secret variable values are stored AES-256-GCM encrypted with the 'enc:' prefix
  variables: jsonb('variables').$type<Variable[]>().notNull().default([]),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Environment = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert
