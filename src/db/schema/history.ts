import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { createId } from '../utils'

export const history = pgTable('history', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  requestId: text('request_id'), // nullable — ad-hoc requests have no saved requestId
  userId: text('user_id').notNull().references(() => users.id),
  method: text('method').notNull(),
  url: text('url').notNull(),
  requestHeaders: jsonb('request_headers').$type<Record<string, string>>().notNull().default({}),
  requestBody: text('request_body'),
  // Nullable: a request that never sent (SSRF block, pre-script error) has no status
  status: integer('status'),
  statusText: text('status_text'),
  responseHeaders: jsonb('response_headers').$type<Record<string, string>>().default({}),
  // responseBody is capped at 50 KB at write time
  responseBody: text('response_body').notNull().default(''),
  durationMs: integer('duration_ms').notNull().default(0),
  size: integer('size').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type History = typeof history.$inferSelect
export type NewHistory = typeof history.$inferInsert
