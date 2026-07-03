import { pgTable, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { createId } from '../utils'

export const cookies = pgTable('cookies', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull(),
  name: text('name').notNull(),
  // AES-256-GCM encrypted (same convention as secret variables)
  value: text('value').notNull(),
  path: text('path').notNull().default('/'),
  expires: timestamp('expires', { withTimezone: true }),
  httpOnly: boolean('http_only').notNull().default(false),
  secure: boolean('secure').notNull().default(false),
  sameSite: text('same_site'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  domainNameUnique: uniqueIndex('cookies_workspace_domain_path_name_idx').on(
    table.workspaceId, table.domain, table.path, table.name
  ),
}))

export type Cookie = typeof cookies.$inferSelect
export type NewCookie = typeof cookies.$inferInsert
