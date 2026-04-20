import { eq, and } from 'drizzle-orm'
import { db, requests } from '../index'
import type { KeyValuePair, RequestBody, RequestAuth, HttpMethod } from '../schema'

export async function findRequestsByCollection(collectionId: string) {
  return db.select().from(requests).where(eq(requests.collectionId, collectionId))
}

export async function findRequestById(id: string) {
  const rows = await db.select().from(requests).where(eq(requests.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findRequestByIdForCollection(id: string, collectionId: string) {
  const rows = await db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.collectionId, collectionId)))
    .limit(1)
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
  await db.delete(requests).where(eq(requests.id, id))
}
