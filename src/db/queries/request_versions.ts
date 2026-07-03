import { eq, and, desc, inArray } from 'drizzle-orm'
import { db, requestVersions } from '../index'
import type { KeyValuePair, RequestBody, RequestAuth, HttpMethod } from '../schema'

// Versions are manual snapshots, not autosaves, but a request that gets a lot of
// "Save Version" clicks over its lifetime shouldn't grow the table unbounded —
// keep the most recent N and silently drop older ones on each new save.
const MAX_VERSIONS_PER_REQUEST = 20

export async function createRequestVersion(data: {
  workspaceId: string
  requestId: string
  label?: string
  method: HttpMethod
  url: string
  params: KeyValuePair[]
  headers: KeyValuePair[]
  body: RequestBody
  auth: RequestAuth
  preRequestScript: string
  postRequestScript: string
  createdBy: string
}) {
  const rows = await db.insert(requestVersions).values(data).returning()
  await pruneRequestVersions(data.requestId)
  return rows[0]!
}

async function pruneRequestVersions(requestId: string) {
  const all = await db
    .select({ id: requestVersions.id })
    .from(requestVersions)
    .where(eq(requestVersions.requestId, requestId))
    .orderBy(desc(requestVersions.createdAt))
  const toDelete = all.slice(MAX_VERSIONS_PER_REQUEST).map(r => r.id)
  if (toDelete.length > 0) {
    await db.delete(requestVersions).where(inArray(requestVersions.id, toDelete))
  }
}

export async function deleteRequestVersion(id: string) {
  await db.delete(requestVersions).where(eq(requestVersions.id, id))
}

export async function findRequestVersionsByRequest(requestId: string, limit = 20) {
  return db
    .select()
    .from(requestVersions)
    .where(eq(requestVersions.requestId, requestId))
    .orderBy(desc(requestVersions.createdAt))
    .limit(limit)
}

export async function findRequestVersionByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(requestVersions)
    .where(and(eq(requestVersions.id, id), eq(requestVersions.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}
