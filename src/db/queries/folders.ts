import { eq, and } from 'drizzle-orm'
import { db, folders } from '../index'

export async function findFoldersByCollection(collectionId: string) {
  return db.select().from(folders).where(eq(folders.collectionId, collectionId))
}

export async function findFolderById(id: string) {
  const rows = await db.select().from(folders).where(eq(folders.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createFolder(data: {
  collectionId: string
  parentFolderId?: string | null
  name: string
}) {
  const rows = await db.insert(folders).values(data).returning()
  return rows[0]!
}

export async function updateFolder(id: string, data: { name: string }) {
  const rows = await db
    .update(folders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(folders.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteFolder(id: string) {
  await db.delete(folders).where(eq(folders.id, id))
}
