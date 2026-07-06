import { desc } from 'drizzle-orm'
import { db, adminAuditLogs } from '../index'
import type { AdminAuditAction } from '../schema'

export async function logAdminAction(data: {
  actorId: string
  actorEmail: string
  action: AdminAuditAction
  targetUserId: string
  targetUserEmail: string
  targetUserName: string
}) {
  await db.insert(adminAuditLogs).values(data)
}

export async function listAdminAuditLogs(limit = 100) {
  return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(limit)
}
