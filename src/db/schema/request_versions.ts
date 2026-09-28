import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { requests } from './requests'
import { users } from './users'
import { createId } from '../utils'
import type { HttpMethod, KeyValuePair, RequestBody, RequestAuth } from './index'

// A version is a manual snapshot of a request's content (method/url/params/
// headers/body/auth/scripts) at a point in time — created via "Save Version"
// in the editor, restorable later. Mirrors flow_versions.ts's role for flows.
export const requestVersions = pgTable('request_versions', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  requestId: text('request_id').notNull().references(() => requests.id, { onDelete: 'cascade' }),
  // Optional user-provided label, e.g. "Before auth rework". Falls back to a timestamp in the UI when empty.
  label: text('label'),
  method: text('method').$type<HttpMethod>().notNull(),
  url: text('url').notNull(),
  params: jsonb('params').$type<KeyValuePair[]>().notNull(),
  headers: jsonb('headers').$type<KeyValuePair[]>().notNull(),
  body: jsonb('body').$type<RequestBody>().notNull(),
  auth: jsonb('auth').$type<RequestAuth>().notNull(),
  preRequestScript: text('pre_request_script').notNull().default(''),
  postRequestScript: text('post_request_script').notNull().default(''),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RequestVersion = typeof requestVersions.$inferSelect
export type NewRequestVersion = typeof requestVersions.$inferInsert
