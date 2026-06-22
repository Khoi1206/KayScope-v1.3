import type { ExecuteInput } from '@/schemas'
import { interpolate, buildHeaders } from '@/core/interpolation/engine'
import { emptyScopes, mergeScopes } from '@/core/interpolation/scope'
import { createDynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'
import { buildRequestBody } from './body-builder'
import { resolveAuthHeaders } from './auth-header'
import { httpClient, type HttpResponse } from './http-client'
import { ssrfGuard } from './ssrf-guard'
import { checkRateLimit } from './rate-limit'
import { getRedisClient } from '@/lib/redis'
import { executeScript, type ScriptContext } from '@/lib/scripting/sandbox'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { findEnvironmentByIdForWorkspace } from '@/db/queries/environments'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { decryptVariables } from './variable-crypto'
import { saveToHistory } from './history-persister'
import { persistMutations } from './variable-persister'
import logger from '@/lib/logger'

// ── Result types ───────────────────────────────────────────────────────────

export interface ExecuteResult {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  durationMs?: number
  size?: number
  tests?: Array<{ name: string; passed: boolean; error?: string }>
  logs?: string[]
  preScriptError?: string
  postScriptError?: string
  error?: string
  rateLimited?: boolean
}

// ── Executor ───────────────────────────────────────────────────────────────

export async function execute(
  input: ExecuteInput,
  userId: string,
  ip: string
): Promise<ExecuteResult> {
  if (!await checkRateLimit(ip, getRedisClient())) {
    return { rateLimited: true, error: 'Rate limit exceeded. Try again in a moment.' }
  }

  // 1. Load server-side scopes from DB
  const [workspace, environment, collection] = await Promise.all([
    findWorkspaceById(input.workspaceId),
    input.environmentId ? findEnvironmentByIdForWorkspace(input.environmentId, input.workspaceId) : null,
    input.collectionId ? findCollectionByIdForWorkspace(input.collectionId, input.workspaceId) : null,
  ])

  const globalVars = decryptVariables(workspace?.globalVariables ?? [])
  const envVars = decryptVariables(environment?.variables ?? [])
  const collectionVars = decryptVariables(collection?.variables ?? [])

  // 2. Build full scope set
  const scopes = mergeScopes(emptyScopes(), {
    local: input.scopes?.local ?? {},
    data: input.scopes?.data ?? {},
    environment: envVars,
    collection: collectionVars,
    global: globalVars,
  })

  // 3. Create dynamic var snapshot (consistent within this execution)
  const dynamicVars = createDynamicVarSnapshot()

  // 4. Build script context (pre-request: raw uninterpolated values)
  const scriptCtx: ScriptContext = {
    local: { ...scopes.local },
    environment: envVars,
    collection: collectionVars,
    global: globalVars,
    request: {
      method: input.method,
      url: input.url,
      headers: Object.fromEntries(
        (input.headers ?? []).filter(h => h.enabled && h.key).map(h => [h.key, h.value])
      ),
      body: input.body?.content ?? null,
    },
  }

  // 5. Run pre-request script
  let preScriptError: string | undefined
  let preLogs: string[] = []
  let preTests: Array<{ name: string; passed: boolean; error?: string }> = []
  let effectiveHeaders = input.headers ?? []
  let effectiveBody = input.body
  if (input.preRequestScript?.trim()) {
    const preResult = await executeScript(input.preRequestScript, scriptCtx)
    preScriptError = preResult.error
    preLogs = preResult.logs
    preTests = preResult.tests
    if (preScriptError) {
      return { preScriptError, logs: preLogs, tests: preTests }
    }
    applyMutationsToContext(scriptCtx, preResult.mutations)
    mergeScriptMutations(scopes, preResult.mutations)
    const rm = preResult.mutations.requestMutations
    if (rm) {
      for (const [key, value] of Object.entries(rm.headers)) {
        const idx = effectiveHeaders.findIndex(h => h.key.toLowerCase() === key.toLowerCase())
        if (idx >= 0) {
          effectiveHeaders = effectiveHeaders.map((h, i) => i === idx ? { ...h, value } : h)
        } else {
          effectiveHeaders = [...effectiveHeaders, { key, value, enabled: true }]
        }
      }
      if (rm.body !== undefined && effectiveBody) {
        effectiveBody = { ...effectiveBody, content: rm.body }
      }
    }
  }

  // 6. Build URL with query params
  const interpolatedUrl = interpolate(input.url, scopes, dynamicVars)
  let finalUrl: string
  try {
    const url = new URL(interpolatedUrl)
    const paramPairs = (input.params ?? []).filter(p => p.enabled)
    for (const p of paramPairs) {
      const key = interpolate(p.key, scopes, dynamicVars).trim()
      const value = interpolate(p.value, scopes, dynamicVars)
      if (key) url.searchParams.append(key, value)
    }
    finalUrl = url.href
  } catch {
    return { error: `Invalid URL: "${interpolatedUrl}"` }
  }

  // 7. SSRF check
  try {
    await ssrfGuard.assertSafe(finalUrl)
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'SSRF check failed' }
  }

  // 8. Build headers (user headers + auth headers, merged)
  const userHeaders = buildHeaders(effectiveHeaders, scopes, dynamicVars)
  const authHeaders = resolveAuthHeaders(input.auth, scopes, dynamicVars)
  const mergedHeaders: Record<string, string> = { ...authHeaders, ...userHeaders }

  // 9. Build body
  const { body, contentType } = await buildRequestBody(effectiveBody, scopes, dynamicVars)
  if (contentType && !mergedHeaders['content-type'] && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = contentType
  }

  // 10. Execute HTTP request
  let httpResponse: HttpResponse
  try {
    httpResponse = await httpClient.send({ method: input.method, url: finalUrl, headers: mergedHeaders, body })
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Request failed' }
  }

  scriptCtx.request = {
    method: input.method,
    url: finalUrl,
    headers: mergedHeaders,
    body: typeof body === 'string' ? body : null,
  }

  // 11. Run post-request script
  let postScriptError: string | undefined
  let postLogs: string[] = []
  let postTests: Array<{ name: string; passed: boolean; error?: string }> = []

  if (input.postRequestScript?.trim()) {
    const postResult = await executeScript(input.postRequestScript, scriptCtx, {
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      body: httpResponse.body,
      durationMs: httpResponse.durationMs,
    })
    postScriptError = postResult.error
    postLogs = postResult.logs
    postTests = postResult.tests

    applyMutationsToContext(scriptCtx, postResult.mutations)

    // 12. Persist scope mutations back to DB (fire-and-forget)
    persistMutations(
      { workspaceId: input.workspaceId, environmentId: input.environmentId, collectionId: input.collectionId },
      postResult.mutations
    ).catch(err => logger.error(err, 'Failed to persist script mutations'))
  }

  // 13. Build response
  const result: ExecuteResult = {
    status: httpResponse.status,
    statusText: httpResponse.statusText,
    headers: httpResponse.headers,
    body: httpResponse.body,
    durationMs: httpResponse.durationMs,
    size: httpResponse.size,
    tests: [...preTests, ...postTests],
    logs: [...preLogs, ...postLogs],
    preScriptError,
    postScriptError,
  }

  // 14. Record history (fire-and-forget — never blocks the response)
  saveToHistory(input, userId, finalUrl, mergedHeaders, typeof body === 'string' ? body : null, result)
    .catch(err => logger.warn(err, 'Failed to save history entry'))

  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────

function applyMutationsToContext(
  ctx: ScriptContext,
  mutations: { local: Record<string, string>; environment: Record<string, string>; collection: Record<string, string>; global: Record<string, string> }
) {
  Object.assign(ctx.local, mutations.local)
  Object.assign(ctx.environment, mutations.environment)
  Object.assign(ctx.collection, mutations.collection)
  Object.assign(ctx.global, mutations.global)
}

function mergeScriptMutations(
  scopes: ReturnType<typeof emptyScopes>,
  mutations: { local: Record<string, string>; environment: Record<string, string>; collection: Record<string, string>; global: Record<string, string> }
) {
  Object.assign(scopes.local, mutations.local)
  Object.assign(scopes.environment, mutations.environment)
  Object.assign(scopes.collection, mutations.collection)
  Object.assign(scopes.global, mutations.global)
}
