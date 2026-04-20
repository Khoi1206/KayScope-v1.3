import { pgTable, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'
import { collections } from './collections'
import { users } from './users'
import { createId } from '../utils'
import type { HttpMethod, KeyValuePair, RequestBody, RequestAuth } from './index'

export const requests = pgTable('requests', {
  id: text('id').primaryKey().$defaultFn(createId),
  collectionId: text('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  folderId: text('folder_id'), // nullable — root-level requests have no folder
  name: text('name').notNull(),
  method: text('method').$type<HttpMethod>().notNull().default('GET'),
  url: text('url').notNull().default(''),
  params: jsonb('params').$type<KeyValuePair[]>().notNull().default([]),
  headers: jsonb('headers').$type<KeyValuePair[]>().notNull().default([]),
  body: jsonb('body').$type<RequestBody>().notNull().default({ type: 'none', content: '' }),
  auth: jsonb('auth').$type<RequestAuth>().notNull().default({ type: 'none' }),
  preRequestScript: text('pre_request_script').notNull().default(''),
  postRequestScript: text('post_request_script').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Request = typeof requests.$inferSelect
export type NewRequest = typeof requests.$inferInsert
