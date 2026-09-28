import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createId } from '../utils'
import { users } from './users'

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // sha256 hex of the 6-digit code — the raw code is never persisted.
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert
