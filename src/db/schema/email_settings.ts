import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { createId } from '../utils'

// Single global row — no per-workspace scoping. Values are read/written only
// through the admin CMS; `password` is stored AES-256-GCM encrypted (`enc:` prefix,
// see src/lib/crypto.ts) and never returned to the client in plaintext.
export const emailSettings = pgTable('email_settings', {
  id: text('id').primaryKey().$defaultFn(createId),
  host: text('host').notNull().default(''),
  port: integer('port').notNull().default(587),
  secure: boolean('secure').notNull().default(true),
  username: text('username').notNull().default(''),
  password: text('password').notNull().default(''),
  fromAddress: text('from_address').notNull().default(''),
  fromName: text('from_name').notNull().default(''),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type EmailSettings = typeof emailSettings.$inferSelect
export type NewEmailSettings = typeof emailSettings.$inferInsert
