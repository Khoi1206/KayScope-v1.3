import type { ExecuteInput } from '@/schemas'
import { interpolate, buildHeaders, buildParams } from '@/core/interpolation/engine'
import { emptyScopes, mergeScopes } from '@/core/interpolation/scope'
import { createDynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'
import { buildRequestBody, type BuiltBody } from './body-builder'
import { resolveAuthHeaders } from './auth-header'
import { httpClient, type HttpResponse } from './http-client'
import { ssrfGuard } from './ssrf-guard'
import { checkRateLimit } from './rate-limit'
import { getRedisClient } from '@/lib/redis'
import { executeScript, type ScriptContext } from '@/lib/scripting/sandbox'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { findEnvironmentById } from '@/db/queries/environments'
import { findCollectionById } from '@/db/queries/collections'
import { decryptValue, encryptValue, isEncrypted } from '@/lib/crypto'
import type { Variable } from '@/db/schema'
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
  // Rate limit
  if (!await checkRateLimit(ip, getRedisClient())) {
    return { rateLimited: true, error: 'Rate limit exceeded. Try again in a moment.' }
  }

  // 1. Load server-side scopes from DB
  const [workspace, environment, collection] = await Promise.all([
    findWorkspaceById(input.workspaceId),
    input.environmentId ? findEnvironmentById(input.environmentId) : null,
    input.collectionId ? findCollectionById(input.collectionId) : null,
  ])

  const globalVars = decryptAllVariables(workspace?.globalVariables ?? [])
  const envVars = decryptAllVariables(environment?.variables ?? [])
  const collectionVars = decryptAllVariables(collection?.variables ?? [])

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
  if (input.preRequestScript?.trim()) {
    const preResult = await executeScript(input.preRequestScript, scriptCtx)
    preScriptError = preResult.error
    if (preScriptError) {
      return { preScriptError, logs: preResult.logs, tests: preResult.tests }
    }
    // Apply pre-script mutations to scopes
    applyMutationsToContext(scriptCtx, preResult.mutations)
    mergeScriptMutations(scopes, preResult.mutations)
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
  const userHeaders = buildHeaders(input.headers ?? [], scopes, dynamicVars)
  const authHeaders = resolveAuthHeaders(input.auth, scopes, dynamicVars)
  const mergedHeaders: Record<string, string> = { ...authHeaders, ...userHeaders }

  // 9. Build body
  const { body, contentType } = buildRequestBody(input.body, scopes, dynamicVars)
  if (contentType && !mergedHeaders['content-type'] && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = contentType
  }

  // 10. Execute HTTP request
  let httpResponse: HttpResponse
  try {
    httpResponse = await httpClient.send({
      method: input.method,
      url: finalUrl,
      headers: mergedHeaders,
      body: body,
    })
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Request failed' }
  }

  // Update pm.request to resolved values for post-request script
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
    const postResult = await executeScript(
      input.postRequestScript,
      scriptCtx,
      {
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        headers: httpResponse.headers,
        body: httpResponse.body,
        durationMs: httpResponse.durationMs,
      }
    )
    postScriptError = postResult.error
    postLogs = postResult.logs
    postTests = postResult.tests

    // Apply post-script mutations
    applyMutationsToContext(scriptCtx, postResult.mutations)

    // 12. Persist scope mutations back to DB (fire-and-forget)
    persistMutations(input, userId, scriptCtx, postResult.mutations).catch(err => {
      logger.error(err, 'Failed to persist script mutations')
    })
  }

  // 13. Build response
  const result: ExecuteResult = {
    status: httpResponse.status,
    statusText: httpResponse.statusText,
    headers: httpResponse.headers,
    body: httpResponse.body,
    durationMs: httpResponse.durationMs,
    size: httpResponse.size,
    tests: postTests,
    logs: postLogs,
    preScriptError,
    postScriptError,
  }

  // 14. Record history (fire-and-forget — never blocks the response)
  saveToHistory(input, userId, finalUrl, mergedHeaders, body, result).catch(err => {
    logger.warn(err, 'Failed to save history entry')
  })

  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────

function decryptAllVariables(variables: Variable[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const v of variables) {
    if (!v.enabled) continue
    result[v.key] = isEncrypted(v.value) ? decryptValue(v.value) : v.value
  }
  return result
}

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

async function saveToHistory(
  input: ExecuteInput,
  userId: string,
  resolvedUrl: string,
  requestHeaders: Record<string, string>,
  requestBody: BuiltBody['body'],
  result: ExecuteResult
) {
  const { createHistory } = await import('@/db/queries/history')
  await createHistory({
    workspaceId: input.workspaceId,
    requestId: input.requestId ?? null,
    userId,
    method: input.method,
    url: resolvedUrl,
    requestHeaders,
    requestBody: typeof requestBody === 'string' ? requestBody : null,
    status: result.status ?? null,
    statusText: result.statusText ?? null,
    responseHeaders: result.headers ?? null,
    responseBody: result.body ?? null,
    durationMs: result.durationMs ?? null,
    size: result.size ?? null,
  })
}

async function persistMutations(
  input: ExecuteInput,
  userId: string,
  ctx: ScriptContext,
  mutations: { environment: Record<string, string>; collection: Record<string, string>; global: Record<string, string> }
) {
  const { updateEnvironment } = await import('@/db/queries/environments')
  const { updateCollection } = await import('@/db/queries/collections')
  const { updateWorkspace } = await import('@/db/queries/workspaces')

  function applyMutationsToVars(
    vars: Variable[],
    mutated: Record<string, string>
  ): Variable[] {
    const updated = vars.map(v => {
      if (mutated[v.key] === undefined) return v
      const newVal = mutated[v.key]!
      return { ...v, value: v.secret ? encryptValue(newVal) : newVal }
    })
    for (const [key, value] of Object.entries(mutated)) {
      if (!updated.find(v => v.key === key)) {
        updated.push({ key, value, enabled: true, secret: false })
      }
    }
    return updated
  }

  // Persist environment mutations
  if (input.environmentId && Object.keys(mutations.environment).length > 0) {
    const { findEnvironmentById } = await import('@/db/queries/environments')
    const env = await findEnvironmentById(input.environmentId)
    if (env) {
      await updateEnvironment(input.environmentId, {
        variables: applyMutationsToVars(env.variables, mutations.environment),
      })
    }
  }

  // Persist collection variable mutations
  if (input.collectionId && Object.keys(mutations.collection).length > 0) {
    const col = await findCollectionById(input.collectionId)
    if (col) {
      await updateCollection(input.collectionId, {
        variables: applyMutationsToVars(col.variables, mutations.collection),
      })
    }
  }

  // Persist global variable mutations
  if (Object.keys(mutations.global).length > 0) {
    const ws = await findWorkspaceById(input.workspaceId)
    if (ws) {
      await updateWorkspace(input.workspaceId, {
        globalVariables: applyMutationsToVars(ws.globalVariables, mutations.global),
      })
    }
  }
}
