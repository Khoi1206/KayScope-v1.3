import { eq, and } from 'drizzle-orm'
import { db, collections, folders, requests } from '../index'
import type { Variable } from '../schema'

export async function findCollectionsByWorkspace(workspaceId: string) {
  return db.select().from(collections).where(eq(collections.workspaceId, workspaceId))
}

export async function findCollectionById(id: string) {
  const rows = await db.select().from(collections).where(eq(collections.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findCollectionByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createCollection(
  workspaceId: string,
  data: { name: string; description?: string; createdBy: string }
) {
  const rows = await db
    .insert(collections)
    .values({ workspaceId, ...data, variables: [] })
    .returning()
  return rows[0]!
}

export async function updateCollection(
  id: string,
  data: Partial<{ name: string; description: string; variables: Variable[] }>
) {
  const rows = await db
    .update(collections)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteCollection(id: string) {
  // Cascade: folders and requests are deleted via DB cascade constraints
  await db.delete(collections).where(eq(collections.id, id))
}
