import { eq, and, asc, isNull, isNotNull, desc, inArray } from 'drizzle-orm'
import { db, requests } from '../index'
import type { KeyValuePair, RequestBody, RequestAuth, HttpMethod } from '../schema'

export async function findRequestsByCollection(collectionId: string) {
  return db.select().from(requests)
    .where(and(eq(requests.collectionId, collectionId), isNull(requests.deletedAt)))
    .orderBy(asc(requests.sortOrder), asc(requests.createdAt))
}

/** Recently soft-deleted requests across a workspace's collections (for the Trash view). */
export async function findDeletedRequestsByCollectionIds(collectionIds: string[]) {
  if (collectionIds.length === 0) return []
  return db.select().from(requests)
    .where(and(inArray(requests.collectionId, collectionIds), isNotNull(requests.deletedAt)))
    .orderBy(desc(requests.deletedAt))
}

export async function reorderRequests(items: { id: string; sortOrder: number }[]) {
  await db.transaction(async tx => {
    for (const { id, sortOrder } of items) {
      await tx.update(requests).set({ sortOrder }).where(eq(requests.id, id))
    }
  })
}

export async function findRequestById(id: string) {
  const rows = await db.select().from(requests).where(and(eq(requests.id, id), isNull(requests.deletedAt))).limit(1)
  return rows[0] ?? null
}

export async function findRequestByIdForCollection(id: string, collectionId: string) {
  const rows = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.collectionId, collectionId), isNull(requests.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** Find a soft-deleted request by id (used for restore, bypassing the not-deleted filter). */
export async function findDeletedRequestById(id: string) {
  const rows = await db.select().from(requests).where(and(eq(requests.id, id), isNotNull(requests.deletedAt))).limit(1)
  return rows[0] ?? null
}

export async function createRequest(data: {
  collectionId: string
  folderId?: string | null
  name: string
  method?: HttpMethod
  url?: string
  params?: KeyValuePair[]
  headers?: KeyValuePair[]
  body?: RequestBody
  auth?: RequestAuth
  preRequestScript?: string
  postRequestScript?: string
  createdBy: string
}) {
  const rows = await db
    .insert(requests)
    .values({
      ...data,
      method: data.method ?? 'GET',
      url: data.url ?? '',
    })
    .returning()
  return rows[0]!
}

export async function updateRequest(
  id: string,
  data: Partial<{
    name: string
    folderId: string | null
    method: HttpMethod
    url: string
    params: KeyValuePair[]
    headers: KeyValuePair[]
    body: RequestBody
    auth: RequestAuth
    preRequestScript: string
    postRequestScript: string
  }>
) {
  const rows = await db
    .update(requests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(requests.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteRequest(id: string) {
  await db.update(requests).set({ deletedAt: new Date() }).where(eq(requests.id, id))
}

export async function restoreRequest(id: string) {
  const rows = await db.update(requests).set({ deletedAt: null }).where(eq(requests.id, id)).returning()
  return rows[0] ?? null
}

/** Hard-delete a soft-deleted request permanently. */
export async function purgeRequest(id: string) {
  await db.delete(requests).where(eq(requests.id, id))
}
