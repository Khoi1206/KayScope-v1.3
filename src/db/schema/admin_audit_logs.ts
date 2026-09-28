import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createId } from '../utils'

export type AdminAuditAction =
  | 'grant_admin'
  | 'revoke_admin'
  | 'activate_user'
  | 'deactivate_user'
  | 'delete_user'
  | 'create_user'
  | 'update_user'
  | 'update_email_settings'

// System-wide admin CMS audit trail — distinct from the per-workspace `activityLogs`
// table. No FK constraints: this is an append-only historical record that must
// survive deletion of either the actor or the target user, so actor/target identity
// is captured as an immutable snapshot (id + email + name) at log time.
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: text('id').primaryKey().$defaultFn(createId),
  actorId: text('actor_id').notNull(),
  actorEmail: text('actor_email').notNull(),
  action: text('action').$type<AdminAuditAction>().notNull(),
  targetUserId: text('target_user_id').notNull(),
  targetUserEmail: text('target_user_email').notNull(),
  targetUserName: text('target_user_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect
export type NewAdminAuditLog = typeof adminAuditLogs.$inferInsert
