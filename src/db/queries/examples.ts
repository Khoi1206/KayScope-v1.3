import { eq, and, desc } from 'drizzle-orm'
import { db, examples, requests, collections, workspaces } from '../index'
import type { NewExample } from '../schema/examples'

const BODY_CAP_BYTES = 50 * 1024 // 50 KB

/** List all examples for a request, auth-guarded via workspace ownership. */
export async function getExamplesByRequestId(requestId: string, userId: string) {
  // Verify request belongs to a workspace owned by userId
  const rows = await db
    .select({ example: examples })
    .from(examples)
    .innerJoin(requests, eq(requests.id, examples.requestId))
    .innerJoin(collections, eq(collections.id, requests.collectionId))
    .innerJoin(workspaces, eq(workspaces.id, collections.workspaceId))
    .where(
      and(
        eq(examples.requestId, requestId),
        eq(workspaces.ownerId, userId)
      )
    )
    .orderBy(desc(examples.createdAt))

  return rows.map(r => r.example)
}

/** Insert a new example (body is capped at 50 KB). */
export async function createExample(data: {
  requestId: string
  workspaceId: string
  name: string
  status?: number | null
  statusText?: string | null
  responseHeaders?: Record<string, string> | null
  responseBody?: string | null
  durationMs?: number | null
  size?: number | null
  requestMethod?: string | null
  requestUrl?: string | null
  requestParams?: NewExample['requestParams']
  requestHeaders?: NewExample['requestHeaders']
  requestBody?: NewExample['requestBody']
  requestAuth?: NewExample['requestAuth']
  createdBy: string
}) {
  let responseBody = data.responseBody ?? null
  if (responseBody && Buffer.byteLength(responseBody, 'utf8') > BODY_CAP_BYTES) {
    responseBody = responseBody.slice(0, BODY_CAP_BYTES) + '\n[truncated]'
  }

  const insertData: NewExample = {
    requestId: data.requestId,
    workspaceId: data.workspaceId,
    name: data.name,
    createdBy: data.createdBy,
    status: data.status ?? undefined,
    statusText: data.statusText ?? undefined,
    responseHeaders: data.responseHeaders ?? undefined,
    responseBody: responseBody ?? undefined,
    durationMs: data.durationMs ?? undefined,
    size: data.size ?? undefined,
    requestMethod: data.requestMethod ?? undefined,
    requestUrl: data.requestUrl ?? undefined,
    requestParams: data.requestParams ?? undefined,
    requestHeaders: data.requestHeaders ?? undefined,
    requestBody: data.requestBody ?? undefined,
    requestAuth: data.requestAuth ?? undefined,
  }

  const rows = await db.insert(examples).values(insertData).returning()
  return rows[0]!
}

/** Rename an example, auth-guarded. */
export async function updateExample(id: string, userId: string, patch: { name: string }) {
  const rows = await db
    .select({ example: examples })
    .from(examples)
    .innerJoin(requests, eq(requests.id, examples.requestId))
    .innerJoin(collections, eq(collections.id, requests.collectionId))
    .innerJoin(workspaces, eq(workspaces.id, collections.workspaceId))
    .where(and(eq(examples.id, id), eq(workspaces.ownerId, userId)))
    .limit(1)

  if (!rows[0]) return null

  const updated = await db
    .update(examples)
    .set({ name: patch.name })
    .where(eq(examples.id, id))
    .returning()

  return updated[0] ?? null
}

/** Delete an example, auth-guarded. */
export async function deleteExample(id: string, userId: string) {
  const rows = await db
    .select({ exampleId: examples.id })
    .from(examples)
    .innerJoin(requests, eq(requests.id, examples.requestId))
    .innerJoin(collections, eq(collections.id, requests.collectionId))
    .innerJoin(workspaces, eq(workspaces.id, collections.workspaceId))
    .where(and(eq(examples.id, id), eq(workspaces.ownerId, userId)))
    .limit(1)

  if (!rows[0]) return false

  await db.delete(examples).where(eq(examples.id, id))
  return true
}
