import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { collections } from './collections'
import { users } from './users'
import { createId } from '../utils'

export const testSuites = pgTable('test_suites', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  collectionId: text('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  // Reference only — server loads and decrypts env variables at run time
  environmentId: text('environment_id'),
  // Saved data rows for iteration; same shape as DataRow[] from lib/data-parser
  dataRows: jsonb('data_rows').$type<Record<string, string>[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TestSuite = typeof testSuites.$inferSelect
export type NewTestSuite = typeof testSuites.$inferInsert
