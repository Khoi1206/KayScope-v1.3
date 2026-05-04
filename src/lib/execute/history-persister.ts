import type { ExecuteInput } from '@/schemas'

export interface HistoryResult {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  durationMs?: number
  size?: number
}

export async function saveToHistory(
  input: ExecuteInput,
  userId: string,
  resolvedUrl: string,
  requestHeaders: Record<string, string>,
  requestBody: string | null,
  result: HistoryResult
): Promise<void> {
  const { createHistory } = await import('@/db/queries/history')
  await createHistory({
    workspaceId: input.workspaceId,
    requestId: input.requestId ?? null,
    userId,
    method: input.method,
    url: resolvedUrl,
    requestHeaders,
    requestBody,
    status: result.status ?? null,
    statusText: result.statusText ?? null,
    responseHeaders: result.headers ?? null,
    responseBody: result.body ?? null,
    durationMs: result.durationMs ?? null,
    size: result.size ?? null,
  })
}
