import { eq } from 'drizzle-orm'
import { db, workspaces } from '../index'
import type { Variable } from '../schema'

export async function findWorkspaceByOwner(ownerId: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
    .limit(1)
  return rows[0] ?? null
}

export async function findWorkspaceById(id: string) {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createWorkspace(ownerId: string, name: string) {
  const rows = await db
    .insert(workspaces)
    .values({ ownerId, name, globalVariables: [] })
    .returning()
  return rows[0]!
}

/** Get or create the user's personal workspace. */
export async function upsertPersonalWorkspace(ownerId: string, name: string) {
  const existing = await findWorkspaceByOwner(ownerId)
  if (existing) return existing
  return createWorkspace(ownerId, name)
}

export async function updateWorkspace(
  id: string,
  data: Partial<{ name: string; globalVariables: Variable[]; activeEnvironmentId: string | null }>
) {
  const rows = await db
    .update(workspaces)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning()
  return rows[0] ?? null
}
