import { eq, and, asc, isNull, isNotNull } from 'drizzle-orm'
import { db, collections, folders, requests } from '../index'
import type { Variable } from '../schema'

export async function findCollectionsByWorkspace(workspaceId: string) {
  return db.select().from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), isNull(collections.deletedAt)))
    .orderBy(asc(collections.sortOrder), asc(collections.createdAt))
}

export async function findDeletedCollectionsByWorkspace(workspaceId: string) {
  return db.select().from(collections)
    .where(and(eq(collections.workspaceId, workspaceId), isNotNull(collections.deletedAt)))
}

export async function reorderCollections(items: { id: string; sortOrder: number }[]) {
  await db.transaction(async tx => {
    for (const { id, sortOrder } of items) {
      await tx.update(collections).set({ sortOrder }).where(eq(collections.id, id))
    }
  })
}

export async function findCollectionById(id: string) {
  const rows = await db.select().from(collections).where(eq(collections.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findCollectionByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.workspaceId, workspaceId), isNull(collections.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** Ownership check that also matches soft-deleted collections (used by restore/purge). */
export async function findCollectionByIdForWorkspaceAny(id: string, workspaceId: string) {
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
  data: Partial<{ name: string; description: string; variables: Variable[]; preRequestScript: string; postRequestScript: string }>
) {
  const rows = await db
    .update(collections)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteCollection(id: string) {
  const now = new Date()
  await db.transaction(async tx => {
    await tx.update(collections).set({ deletedAt: now }).where(eq(collections.id, id))
    await tx.update(folders).set({ deletedAt: now }).where(eq(folders.collectionId, id))
    await tx.update(requests).set({ deletedAt: now }).where(eq(requests.collectionId, id))
  })
}

export async function restoreCollection(id: string) {
  await db.transaction(async tx => {
    await tx.update(collections).set({ deletedAt: null }).where(eq(collections.id, id))
    await tx.update(folders).set({ deletedAt: null }).where(eq(folders.collectionId, id))
    await tx.update(requests).set({ deletedAt: null }).where(eq(requests.collectionId, id))
  })
}

/** Hard-delete a soft-deleted collection (and its folders/requests) permanently. */
export async function purgeCollection(id: string) {
  await db.delete(collections).where(eq(collections.id, id))
}
