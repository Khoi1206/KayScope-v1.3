import { eq, and, asc, isNull, inArray } from 'drizzle-orm'
import { db, folders, requests } from '../index'

export async function findFoldersByCollection(collectionId: string) {
  return db.select().from(folders)
    .where(and(eq(folders.collectionId, collectionId), isNull(folders.deletedAt)))
    .orderBy(asc(folders.sortOrder), asc(folders.createdAt))
}

export async function reorderFolders(items: { id: string; sortOrder: number }[]) {
  await db.transaction(async tx => {
    for (const { id, sortOrder } of items) {
      await tx.update(folders).set({ sortOrder }).where(eq(folders.id, id))
    }
  })
}

export async function findFolderById(id: string) {
  const rows = await db.select().from(folders).where(and(eq(folders.id, id), isNull(folders.deletedAt))).limit(1)
  return rows[0] ?? null
}

/** Collect this folder's id plus all nested descendant folder ids (within one collection). */
async function collectFolderAndDescendantIds(id: string, collectionId: string): Promise<string[]> {
  const all = await db.select().from(folders).where(eq(folders.collectionId, collectionId))
  const ids = new Set<string>([id])
  let added = true
  while (added) {
    added = false
    for (const f of all) {
      if (f.parentFolderId && ids.has(f.parentFolderId) && !ids.has(f.id)) {
        ids.add(f.id)
        added = true
      }
    }
  }
  return [...ids]
}

export async function createFolder(data: {
  collectionId: string
  parentFolderId?: string | null
  name: string
}) {
  const rows = await db.insert(folders).values(data).returning()
  return rows[0]!
}

export async function updateFolder(id: string, data: { name: string; parentFolderId?: string | null }) {
  const rows = await db
    .update(folders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(folders.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteFolder(id: string, collectionId: string) {
  const ids = await collectFolderAndDescendantIds(id, collectionId)
  const now = new Date()
  await db.transaction(async tx => {
    await tx.update(folders).set({ deletedAt: now }).where(inArray(folders.id, ids))
    await tx.update(requests).set({ deletedAt: now }).where(inArray(requests.folderId, ids))
  })
}
