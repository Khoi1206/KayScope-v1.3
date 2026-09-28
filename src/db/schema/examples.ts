import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { requests } from './requests'
import { users } from './users'
import { createId } from '../utils'
import type { KeyValuePair, RequestBody, RequestAuth } from './index'

export const examples = pgTable('examples', {
  id: text('id').primaryKey().$defaultFn(createId),
  requestId: text('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: integer('status'),
  statusText: text('status_text'),
  responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),
  // Capped at 50 KB at write time (same policy as history)
  responseBody: text('response_body'),
  durationMs: integer('duration_ms'),
  size: integer('size'),
  // Snapshot of the request that produced this example
  requestMethod: text('request_method'),
  requestUrl: text('request_url'),
  requestParams: jsonb('request_params').$type<KeyValuePair[]>(),
  requestHeaders: jsonb('request_headers').$type<KeyValuePair[]>(),
  requestBody: jsonb('request_body').$type<RequestBody>(),
  requestAuth: jsonb('request_auth').$type<RequestAuth>(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Example = typeof examples.$inferSelect
export type NewExample = typeof examples.$inferInsert
