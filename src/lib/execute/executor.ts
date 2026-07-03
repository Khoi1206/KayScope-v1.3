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
import { buildCookieHeader, persistSetCookies, parseSetCookie } from './cookie-jar'
import logger from '@/lib/logger'

// ── Result types ───────────────────────────────────────────────────────────

export interface ExecuteResult {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  durationMs?: number
  ttfbMs?: number
  downloadMs?: number
  isBinary?: boolean
  size?: number
  cookies?: Array<{
    name: string; value: string; domain: string; path: string
    expires: string | null; httpOnly: boolean; secure: boolean; sameSite: string | null
  }>
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

  const allLogs: string[] = []
  const allTests: Array<{ name: string; passed: boolean; error?: string }> = []

  // 5a. Run collection pre-request script (if any)
  const colPreScript = (collection as { preRequestScript?: string | null } | null)?.preRequestScript?.trim()
  if (colPreScript) {
    const colPre = await executeScript(colPreScript, scriptCtx)
    allLogs.push(...colPre.logs)
    allTests.push(...colPre.tests)
    if (colPre.error) {
      return { preScriptError: `[collection] ${colPre.error}`, logs: allLogs, tests: allTests }
    }
    applyMutationsToContext(scriptCtx, colPre.mutations)
    mergeScriptMutations(scopes, colPre.mutations)
  }

  // 5b. Run per-request pre-script
  let preScriptError: string | undefined
  let effectiveHeaders = input.headers ?? []
  let effectiveBody = input.body
  if (input.preRequestScript?.trim()) {
    const preResult = await executeScript(input.preRequestScript, scriptCtx)
    preScriptError = preResult.error
    allLogs.push(...preResult.logs)
    allTests.push(...preResult.tests)
    if (preScriptError) {
      return { preScriptError, logs: allLogs, tests: allTests }
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

  // 5c. OAuth2 auto-fetch token (client_credentials or password grant) — refetch if missing or expired
  const tokenExpiresAt = Number(scopes.local['_oauth2_token_expires_at'] ?? 0)
  const tokenExpired = tokenExpiresAt > 0 && Date.now() >= tokenExpiresAt - 30_000
  if (input.auth?.type === 'oauth2' && (!scopes.local['_oauth2_token'] || tokenExpired)) {
    const grant = input.auth.oauth2GrantType ?? 'client_credentials'
    const tokenUrl = interpolate(input.auth.oauth2TokenUrl ?? '', scopes, dynamicVars)
    const clientId = interpolate(input.auth.oauth2ClientId ?? '', scopes, dynamicVars)
    const clientSecret = interpolate(input.auth.oauth2ClientSecret ?? '', scopes, dynamicVars)
    const scope = interpolate(input.auth.oauth2Scope ?? '', scopes, dynamicVars)
    const useBasicHeader = input.auth.oauth2ClientAuth === 'basic_header'

    if (tokenUrl && clientId && clientSecret) {
      try {
        await ssrfGuard.assertSafe(tokenUrl)
        const body = new URLSearchParams({ grant_type: grant })
        if (!useBasicHeader) {
          body.set('client_id', clientId)
          body.set('client_secret', clientSecret)
        }
        if (scope) body.set('scope', scope)
        if (grant === 'password') {
          const u = interpolate(input.auth.oauth2Username ?? '', scopes, dynamicVars)
          const p = interpolate(input.auth.oauth2Password ?? '', scopes, dynamicVars)
          body.set('username', u)
          body.set('password', p)
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
        if (useBasicHeader) {
          headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        }
        const resp = await fetch(tokenUrl, { method: 'POST', headers, body: body.toString() })
        if (resp.ok) {
          const data = await resp.json() as { access_token?: string; expires_in?: number }
          if (data.access_token) {
            scopes.local['_oauth2_token'] = data.access_token
            scopes.local['_oauth2_token_expires_at'] = data.expires_in
              ? String(Date.now() + data.expires_in * 1000)
              : ''
          }
        }
      } catch (err) {
        logger.warn({ err }, 'OAuth2 token fetch failed')
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

  // 8. Build user headers
  const userHeaders = buildHeaders(effectiveHeaders, scopes, dynamicVars)

  // 9. Build body (moved ahead of auth resolution — OAuth1/AWS SigV4 signing needs
  // the final method/url/headers/body, e.g. to hash the body or sign form params)
  const { body, contentType } = await buildRequestBody(effectiveBody, scopes, dynamicVars)

  // 10. Resolve auth headers. bearer/basic/api-key/oauth2 ignore the signing
  // context; oauth1/aws-sig-v4 use it to compute a request signature.
  const preAuthHeaders = {
    ...userHeaders,
    ...(contentType && !userHeaders['content-type'] && !userHeaders['Content-Type'] ? { 'Content-Type': contentType } : {}),
  }
  const authHeaders = resolveAuthHeaders(input.auth, scopes, dynamicVars, {
    method: input.method,
    url: finalUrl,
    headers: preAuthHeaders,
    body: typeof body === 'string' ? body : null,
  })
  const mergedHeaders: Record<string, string> = { ...authHeaders, ...userHeaders }
  if (contentType && !mergedHeaders['content-type'] && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = contentType
  }

  // 10b. Attach cookie jar cookies (unless caller disabled or already set one manually)
  const requestUrl = new URL(finalUrl)
  if (input.sendCookies !== false && !mergedHeaders['Cookie'] && !mergedHeaders['cookie']) {
    const cookieHeader = await buildCookieHeader(input.workspaceId, requestUrl.hostname, requestUrl.pathname)
    if (cookieHeader) mergedHeaders['Cookie'] = cookieHeader
  }

  // 10. Execute HTTP request
  let httpResponse: HttpResponse
  try {
    httpResponse = await httpClient.send({
      method: input.method,
      url: finalUrl,
      headers: mergedHeaders,
      body,
      timeout: input.timeout,
      followRedirects: input.followRedirects,
      maxRedirects: input.maxRedirects,
      sslVerify: input.sslVerify,
    })
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Request failed' }
  }

  // 10b. Persist Set-Cookie headers into the workspace cookie jar
  if (input.saveCookies !== false && httpResponse.setCookies.length > 0) {
    persistSetCookies(input.workspaceId, httpResponse.setCookies, requestUrl.hostname)
      .catch(err => logger.warn({ err }, 'Failed to persist Set-Cookie into cookie jar'))
  }

  scriptCtx.request = {
    method: input.method,
    url: finalUrl,
    headers: mergedHeaders,
    body: typeof body === 'string' ? body : null,
  }

  // 11. Run per-request post-script
  let postScriptError: string | undefined
  if (input.postRequestScript?.trim()) {
    const postResult = await executeScript(input.postRequestScript, scriptCtx, {
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      body: httpResponse.body,
      durationMs: httpResponse.durationMs,
    })
    postScriptError = postResult.error
    allLogs.push(...postResult.logs)
    allTests.push(...postResult.tests)

    applyMutationsToContext(scriptCtx, postResult.mutations)

    // Persist scope mutations from per-request post-script
    persistMutations(
      { workspaceId: input.workspaceId, environmentId: input.environmentId, collectionId: input.collectionId },
      postResult.mutations
    ).catch(err => logger.error(err, 'Failed to persist script mutations'))
  }

  // 11b. Run collection post-request script (if any)
  const colPostScript = (collection as { postRequestScript?: string | null } | null)?.postRequestScript?.trim()
  if (colPostScript) {
    const colPost = await executeScript(colPostScript, scriptCtx, {
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      body: httpResponse.body,
      durationMs: httpResponse.durationMs,
    })
    allLogs.push(...colPost.logs)
    allTests.push(...colPost.tests)
    if (colPost.error && !postScriptError) {
      postScriptError = `[collection] ${colPost.error}`
    }
    applyMutationsToContext(scriptCtx, colPost.mutations)
    persistMutations(
      { workspaceId: input.workspaceId, environmentId: input.environmentId, collectionId: input.collectionId },
      colPost.mutations
    ).catch(err => logger.error(err, 'Failed to persist collection script mutations'))
  }

  // 12. Build response
  const result: ExecuteResult = {
    status: httpResponse.status,
    statusText: httpResponse.statusText,
    headers: httpResponse.headers,
    body: httpResponse.body,
    durationMs: httpResponse.durationMs,
    ttfbMs: httpResponse.ttfbMs,
    downloadMs: httpResponse.downloadMs,
    isBinary: httpResponse.isBinary,
    size: httpResponse.size,
    cookies: httpResponse.setCookies
      .map(raw => parseSetCookie(raw, requestUrl.hostname))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map(c => ({ ...c, expires: c.expires ? c.expires.toISOString() : null })),
    tests: allTests,
    logs: allLogs,
    preScriptError,
    postScriptError,
  }

  // 13. Record history (fire-and-forget)
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
