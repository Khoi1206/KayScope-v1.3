import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { createId } from '../utils'
import type { Variable } from './index'

export const collections = pgTable('collections', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  variables: jsonb('variables').$type<Variable[]>().notNull().default([]),
  preRequestScript: text('pre_request_script').notNull().default(''),
  postRequestScript: text('post_request_script').notNull().default(''),
  createdBy: text('created_by').notNull().references(() => users.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Collection = typeof collections.$inferSelect
export type NewCollection = typeof collections.$inferInsert
