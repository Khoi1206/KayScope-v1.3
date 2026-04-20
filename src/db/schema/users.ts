import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createId } from '../utils'

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  provider: text('provider').notNull().default('credentials'),
  providerId: text('provider_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
