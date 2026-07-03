import { eq, and } from 'drizzle-orm'
import { db, workspaceMembers, users } from '../index'
import type { WorkspaceRole } from '../schema'

export async function findMembersByWorkspace(workspaceId: string) {
  return db
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(workspaceMembers.createdAt)
}

export async function findMembership(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function addMember(data: {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  invitedBy: string
}) {
  const rows = await db.insert(workspaceMembers).values(data).returning()
  return rows[0]!
}

export async function updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole) {
  const rows = await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .returning()
  return rows[0] ?? null
}

export async function removeMember(workspaceId: string, userId: string) {
  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
}
