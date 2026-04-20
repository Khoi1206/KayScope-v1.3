import { eq, and } from 'drizzle-orm'
import { db, environments } from '../index'
import type { Variable } from '../schema'

export async function findEnvironmentsByWorkspace(workspaceId: string) {
  return db.select().from(environments).where(eq(environments.workspaceId, workspaceId))
}

export async function findEnvironmentById(id: string) {
  const rows = await db.select().from(environments).where(eq(environments.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findEnvironmentByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, id), eq(environments.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createEnvironment(
  workspaceId: string,
  data: { name: string; variables: Variable[]; createdBy: string }
) {
  const rows = await db
    .insert(environments)
    .values({ workspaceId, ...data })
    .returning()
  return rows[0]!
}

export async function updateEnvironment(
  id: string,
  data: Partial<{ name: string; variables: Variable[] }>
) {
  const rows = await db
    .update(environments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(environments.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteEnvironment(id: string) {
  await db.delete(environments).where(eq(environments.id, id))
}


