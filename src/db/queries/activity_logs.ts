import { eq, desc } from 'drizzle-orm'
import { db, activityLogs } from '../index'
import type { ActivityAction, ActivityEntityType } from '../schema'

export async function logActivity(data: {
  workspaceId: string
  actorId: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string
  entityName: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(activityLogs).values(data)
}

export async function findActivityLogsByWorkspace(workspaceId: string, limit = 100) {
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.workspaceId, workspaceId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
}
