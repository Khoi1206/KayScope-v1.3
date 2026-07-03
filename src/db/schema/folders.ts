import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core'
import { collections } from './collections'
import { createId } from '../utils'

export const folders = pgTable('folders', {
  id: text('id').primaryKey().$defaultFn(createId),
  collectionId: text('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  parentFolderId: text('parent_folder_id'), // self-referential — no FK to avoid cycles in migration
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
