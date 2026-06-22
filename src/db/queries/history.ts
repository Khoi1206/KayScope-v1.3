import { eq, and, or, lt, desc } from 'drizzle-orm'
import { db, history } from '../index'

const HISTORY_CAP_BYTES = 50 * 1024 // 50 KB

export async function getHistory(
  workspaceId: string,
  opts: { limit?: number; cursor?: { createdAt: Date; id: string } } = {}
) {
  const limit = Math.min(opts.limit ?? 50, 50)

  // Cursor-based pagination: fetch rows older than the cursor position.
  // Sort is (createdAt DESC, id DESC) so "before cursor" means
  //   createdAt < cursor.createdAt  OR
  //   (createdAt = cursor.createdAt AND id < cursor.id)
  const whereClause = opts.cursor
    ? and(
        eq(history.workspaceId, workspaceId),
        or(
          lt(history.createdAt, opts.cursor.createdAt),
          and(
            eq(history.createdAt, opts.cursor.createdAt),
            lt(history.id, opts.cursor.id)
          )
        )
      )
    : eq(history.workspaceId, workspaceId)

  const rows = await db
    .select()
    .from(history)
    .where(whereClause)
    .orderBy(desc(history.createdAt), desc(history.id))
    .limit(limit + 1)
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows

  const nextCursor =
    hasMore && items.length > 0
      ? { createdAt: items[items.length - 1]!.createdAt, id: items[items.length - 1]!.id }
      : null

  return { items, nextCursor }
}

export async function createHistory(data: {
  workspaceId: string
  requestId?: string | null
  userId: string
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody?: string | null
  status?: number | null
  statusText?: string | null
  responseHeaders?: Record<string, string> | null
  responseBody?: string | null
  durationMs?: number | null
  size?: number | null
}) {
  // Cap response body at 50KB; ensure it's always a string (notNull column)
  let responseBody = data.responseBody ?? ''
  if (responseBody && Buffer.byteLength(responseBody, 'utf8') > HISTORY_CAP_BYTES) {
    responseBody = responseBody.slice(0, HISTORY_CAP_BYTES) + '\n[truncated]'
  }

  // Explicitly map all fields — converts null → undefined for notNull() columns
  const rows = await db
    .insert(history)
    .values({
      workspaceId: data.workspaceId,
      requestId: data.requestId ?? undefined,
      userId: data.userId,
      method: data.method,
      url: data.url,
      requestHeaders: data.requestHeaders,
      requestBody: data.requestBody ?? undefined,
      status: data.status ?? undefined,
      statusText: data.statusText ?? undefined,
      responseHeaders: data.responseHeaders ?? undefined,
      responseBody,
      durationMs: data.durationMs ?? undefined,
      size: data.size ?? undefined,
    })
    .returning()
  return rows[0]!
}

export async function deleteHistoryEntry(id: string, workspaceId: string) {
  await db.delete(history).where(and(eq(history.id, id), eq(history.workspaceId, workspaceId)))
}

export async function clearHistory(workspaceId: string) {
  await db.delete(history).where(eq(history.workspaceId, workspaceId))
}
