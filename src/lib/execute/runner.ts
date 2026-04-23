import { interpolate, buildHeaders, buildParams } from '@/core/interpolation/engine'
import { emptyScopes, mergeScopes } from '@/core/interpolation/scope'
import { createDynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'
import { buildRequestBody } from './body-builder'
import { resolveAuthHeaders } from './auth-header'
import { httpClient } from './http-client'
import { ssrfGuard } from './ssrf-guard'
import { executeScript, type ScriptContext } from '@/lib/scripting/sandbox'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { findEnvironmentById } from '@/db/queries/environments'
import { findCollectionById } from '@/db/queries/collections'
import { findRequestsByCollection } from '@/db/queries/requests'
import { decryptValue, encryptValue, isEncrypted } from '@/lib/crypto'
import type { Variable } from '@/db/schema'
import type { DataRow } from '@/lib/data-parser'
import logger from '@/lib/logger'

// ── Result types ────────────────────────────────────────────────────────────

export interface RequestRunResult {
  requestId: string
  name: string
  method: string
  url: string
  resolvedUrl?: string
  status?: number
  statusText?: string
  durationMs?: number
  tests: Array<{ name: string; passed: boolean; error?: string }>
  logs: string[]
  error?: string
  preScriptError?: string
  postScriptError?: string
}

export interface IterationResult {
  iteration: number          // 1-based
  dataRow: DataRow
  results: RequestRunResult[]
}

export interface RunnerSummary {
  totalRequests: number
  totalIterations: number
  passed: number
  failed: number
  errored: number
  totalDurationMs: number
}

export interface RunnerResult {
  collectionId: string
  collectionName: string
  iterations: IterationResult[]
  summary: RunnerSummary
}

export interface RunnerInput {
  collectionId: string
  workspaceId: string
  environmentId?: string
  /** Data rows for iteration. Empty array = single pass with no data scope. */
  dataRows: DataRow[]
}

// ── Runner ──────────────────────────────────────────────────────────────────

export async function runCollection(
  input: RunnerInput,
  userId: string
): Promise<RunnerResult> {
  // Load collection metadata + requests
  const collection = await findCollectionById(input.collectionId)
  if (!collection) throw new Error(`Collection not found: ${input.collectionId}`)

  const allRequests = await findRequestsByCollection(input.collectionId)
  // Order: top-level first, then folder requests, all sorted by createdAt
  const ordered = [
    ...allRequests.filter(r => !r.folderId),
    ...allRequests.filter(r => !!r.folderId),
  ]

  // Load persistent scopes once (they'll be re-read from DB for mutations)
  const [workspace, environment] = await Promise.all([
    findWorkspaceById(input.workspaceId),
    input.environmentId ? findEnvironmentById(input.environmentId) : null,
  ])

  const globalVars = decryptVars(workspace?.globalVariables ?? [])
  const envVars = decryptVars(environment?.variables ?? [])
  const collectionVars = decryptVars(collection.variables ?? [])

  const iterations = input.dataRows.length > 0 ? input.dataRows : [{}]
  const iterationResults: IterationResult[] = []

  for (let iterIdx = 0; iterIdx < iterations.length; iterIdx++) {
    const dataRow = iterations[iterIdx]!

    // Each iteration starts with fresh local scope — carry-forward happens request-to-request
    let carryLocal: Record<string, string> = {}
    // Take a fresh snapshot of persistent scopes at the start of each iteration
    let iterEnvVars = { ...envVars }
    let iterCollVars = { ...collectionVars }
    let iterGlobalVars = { ...globalVars }

    const requestResults: RequestRunResult[] = []

    for (const req of ordered) {
      const result = await runRequest({
        req,
        workspaceId: input.workspaceId,
        environmentId: input.environmentId,
        collectionId: input.collectionId,
        userId,
        // Scopes entering this request
        localScope: carryLocal,
        dataRow,
        envVars: iterEnvVars,
        collVars: iterCollVars,
        globalVars: iterGlobalVars,
        iteration: iterIdx,
      })

      requestResults.push(result.requestResult)

      // Carry-forward: local mutations flow to the next request in the same iteration
      carryLocal = { ...carryLocal, ...result.localMutations }
      // Persistent scope mutations are reflected in-memory for subsequent requests
      iterEnvVars = { ...iterEnvVars, ...result.envMutations }
      iterCollVars = { ...iterCollVars, ...result.collMutations }
      iterGlobalVars = { ...iterGlobalVars, ...result.globalMutations }
    }

    iterationResults.push({ iteration: iterIdx + 1, dataRow, results: requestResults })
  }

  // Build summary
  const summary = buildSummary(iterationResults)

  return {
    collectionId: input.collectionId,
    collectionName: collection.name,
    iterations: iterationResults,
    summary,
  }
}

// ── Single-request execution (runner-internal) ─────────────────────────────

interface RunRequestInput {
  req: {
    id: string
    name: string
    method: string
    url: string
    params?: Array<{ key: string; value: string; enabled: boolean }>
    headers?: Array<{ key: string; value: string; enabled: boolean }>
    body?: { type: string; content: string; rawType?: string; formData?: unknown[] }
    auth?: { type: string; token?: string; username?: string; password?: string; apiKey?: string; apiKeyHeader?: string }
    preRequestScript?: string | null
    postRequestScript?: string | null
  }
  workspaceId: string
  environmentId?: string
  collectionId: string
  userId: string
  localScope: Record<string, string>
  dataRow: DataRow
  envVars: Record<string, string>
  collVars: Record<string, string>
  globalVars: Record<string, string>
  iteration: number
}

interface RunRequestOutput {
  requestResult: RequestRunResult
  localMutations: Record<string, string>
  envMutations: Record<string, string>
  collMutations: Record<string, string>
  globalMutations: Record<string, string>
}

async function runRequest(inp: RunRequestInput): Promise<RunRequestOutput> {
  const { req } = inp
  const empty: RunRequestOutput = {
    requestResult: {
      requestId: req.id, name: req.name, method: req.method, url: req.url,
      tests: [], logs: [],
    },
    localMutations: {}, envMutations: {}, collMutations: {}, globalMutations: {},
  }

  const scopes = mergeScopes(emptyScopes(), {
    local: inp.localScope,
    data: inp.dataRow,
    environment: inp.envVars,
    collection: inp.collVars,
    global: inp.globalVars,
  })

  const dynamicVars = createDynamicVarSnapshot()

  const scriptCtx: ScriptContext = {
    local: { ...scopes.local },
    environment: inp.envVars,
    collection: inp.collVars,
    global: inp.globalVars,
    iterationData: inp.dataRow,
    iteration: inp.iteration,
    request: {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(
        (req.headers ?? []).filter(h => h.enabled && h.key).map(h => [h.key, h.value])
      ),
      body: req.body?.content ?? null,
    },
  }

  // Pre-request script
  let effectiveHeaders = req.headers ?? []
  let effectiveBody = req.body
  if (req.preRequestScript?.trim()) {
    const pre = await executeScript(req.preRequestScript, scriptCtx)
    if (pre.error) {
      return {
        ...empty,
        requestResult: { ...empty.requestResult, preScriptError: pre.error, logs: pre.logs, tests: pre.tests },
      }
    }
    applyMutations(scriptCtx, scopes, pre.mutations)
    // Apply pm.request.setHeader / pm.request.setBody mutations
    const rm = pre.mutations.requestMutations
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

  // Build URL
  const interpolatedUrl = interpolate(req.url, scopes, dynamicVars)
  let finalUrl: string
  try {
    const url = new URL(interpolatedUrl)
    for (const p of (req.params ?? []).filter(p => p.enabled)) {
      const k = interpolate(p.key, scopes, dynamicVars).trim()
      const v = interpolate(p.value, scopes, dynamicVars)
      if (k) url.searchParams.append(k, v)
    }
    finalUrl = url.href
  } catch {
    return {
      ...empty,
      requestResult: { ...empty.requestResult, error: `Invalid URL: "${interpolatedUrl}"` },
    }
  }

  // SSRF guard
  try {
    await ssrfGuard.assertSafe(finalUrl)
  } catch (err) {
    return {
      ...empty,
      requestResult: { ...empty.requestResult, error: err instanceof Error ? err.message : 'SSRF check failed' },
    }
  }

  // Build headers + body
  const authHeaders = resolveAuthHeaders(req.auth as never, scopes, dynamicVars)
  const userHeaders = buildHeaders(effectiveHeaders, scopes, dynamicVars)
  const mergedHeaders = { ...authHeaders, ...userHeaders }
  const { body, contentType } = buildRequestBody(effectiveBody as never, scopes, dynamicVars)
  if (contentType && !mergedHeaders['content-type'] && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = contentType
  }

  // Execute HTTP
  let httpResponse
  try {
    httpResponse = await httpClient.send({ method: req.method, url: finalUrl, headers: mergedHeaders, body })
  } catch (err) {
    return {
      ...empty,
      requestResult: { ...empty.requestResult, resolvedUrl: finalUrl, error: err instanceof Error ? err.message : 'Request failed' },
    }
  }

  scriptCtx.request = { method: req.method, url: finalUrl, headers: mergedHeaders, body: typeof body === 'string' ? body : null }

  // Post-request script
  let postError: string | undefined
  let postLogs: string[] = []
  let postTests: Array<{ name: string; passed: boolean; error?: string }> = []
  let allMutations = { local: {}, environment: {}, collection: {}, global: {} } as typeof scriptCtx & { local: Record<string, string>; environment: Record<string, string>; collection: Record<string, string>; global: Record<string, string> }

  if (req.postRequestScript?.trim()) {
    const post = await executeScript(req.postRequestScript, scriptCtx, {
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      headers: httpResponse.headers,
      body: httpResponse.body,
      durationMs: httpResponse.durationMs,
    })
    postError = post.error
    postLogs = post.logs
    postTests = post.tests
    applyMutations(scriptCtx, scopes, post.mutations)

    // Persist env/collection/global mutations to DB (async, non-blocking per request)
    persistRunnerMutations(inp, post.mutations).catch(err => {
      logger.warn(err, 'Runner: failed to persist mutations')
    })

    allMutations = post.mutations as typeof allMutations
  }

  return {
    requestResult: {
      requestId: req.id,
      name: req.name,
      method: req.method,
      url: req.url,
      resolvedUrl: finalUrl,
      status: httpResponse.status,
      statusText: httpResponse.statusText,
      durationMs: httpResponse.durationMs,
      tests: postTests,
      logs: postLogs,
      postScriptError: postError,
    },
    localMutations: allMutations.local ?? {},
    envMutations: allMutations.environment ?? {},
    collMutations: allMutations.collection ?? {},
    globalMutations: allMutations.global ?? {},
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function decryptVars(variables: Variable[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of variables) {
    if (!v.enabled) continue
    out[v.key] = isEncrypted(v.value) ? decryptValue(v.value) : v.value
  }
  return out
}

function applyMutations(
  ctx: ScriptContext,
  scopes: ReturnType<typeof emptyScopes>,
  mutations: { local: Record<string, string>; environment: Record<string, string>; collection: Record<string, string>; global: Record<string, string> }
) {
  Object.assign(ctx.local, mutations.local)
  Object.assign(ctx.environment ?? {}, mutations.environment)
  Object.assign(ctx.collection ?? {}, mutations.collection)
  Object.assign(ctx.global ?? {}, mutations.global)
  Object.assign(scopes.local, mutations.local)
  Object.assign(scopes.environment, mutations.environment)
  Object.assign(scopes.collection, mutations.collection)
  Object.assign(scopes.global, mutations.global)
}

async function persistRunnerMutations(
  inp: RunRequestInput,
  mutations: { environment: Record<string, string>; collection: Record<string, string>; global: Record<string, string> }
) {
  const { updateEnvironment } = await import('@/db/queries/environments')
  const { updateCollection } = await import('@/db/queries/collections')
  const { updateWorkspace } = await import('@/db/queries/workspaces')
  const { findEnvironmentById } = await import('@/db/queries/environments')

  function applyToVars(vars: Variable[], mutated: Record<string, string>): Variable[] {
    const updated = vars.map(v => {
      if (mutated[v.key] === undefined) return v
      return { ...v, value: v.secret ? encryptValue(mutated[v.key]!) : mutated[v.key]! }
    })
    for (const [key, value] of Object.entries(mutated)) {
      if (!updated.find(v => v.key === key)) updated.push({ key, value, enabled: true, secret: false })
    }
    return updated
  }

  if (inp.environmentId && Object.keys(mutations.environment).length > 0) {
    const env = await findEnvironmentById(inp.environmentId)
    if (env) await updateEnvironment(inp.environmentId, { variables: applyToVars(env.variables, mutations.environment) })
  }

  if (inp.collectionId && Object.keys(mutations.collection).length > 0) {
    const col = await findCollectionById(inp.collectionId)
    if (col) await updateCollection(inp.collectionId, { variables: applyToVars(col.variables ?? [], mutations.collection) })
  }

  if (Object.keys(mutations.global).length > 0) {
    const ws = await findWorkspaceById(inp.workspaceId)
    if (ws) await updateWorkspace(inp.workspaceId, { globalVariables: applyToVars(ws.globalVariables, mutations.global) })
  }
}

function buildSummary(iterations: IterationResult[]): RunnerSummary {
  let passed = 0, failed = 0, errored = 0, totalDurationMs = 0

  for (const iter of iterations) {
    for (const r of iter.results) {
      if (r.error || r.preScriptError) { errored++; continue }
      totalDurationMs += r.durationMs ?? 0
      passed += r.tests.filter(t => t.passed).length
      failed += r.tests.filter(t => !t.passed).length
    }
  }

  const firstIter = iterations[0]
  return {
    totalRequests: firstIter?.results.length ?? 0,
    totalIterations: iterations.length,
    passed,
    failed,
    errored,
    totalDurationMs,
  }
}
