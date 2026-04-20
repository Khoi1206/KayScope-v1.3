import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'
import { createId } from '../utils'
import type { Variable } from './index'

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  globalVariables: jsonb('global_variables').$type<Variable[]>().notNull().default([]),
  activeEnvironmentId: text('active_environment_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
