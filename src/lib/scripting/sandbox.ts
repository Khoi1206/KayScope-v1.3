import Piscina from 'piscina'
import path from 'path'
import logger from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScriptContext {
  local: Record<string, string>
  environment: Record<string, string>
  collection: Record<string, string>
  global: Record<string, string>
  request?: {
    method: string
    url: string
    headers: Record<string, string>
    body: unknown
  }
  /** Current iteration's data row (collection runner only) */
  iterationData?: Record<string, string>
  /** 0-based iteration index (collection runner only) */
  iteration?: number
}

export interface RequestMutations {
  headers: Record<string, string>
  body?: string
}

export interface ScriptMutations {
  local: Record<string, string>
  environment: Record<string, string>
  collection: Record<string, string>
  global: Record<string, string>
  requestMutations?: RequestMutations
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface ScriptResult {
  mutations: ScriptMutations
  requestMutations?: RequestMutations
  tests: TestResult[]
  logs: string[]
  error?: string
}

// ── Worker pool ────────────────────────────────────────────────────────────

const SCRIPT_TIMEOUT_MS = 10_000
const WORKER_FILE = path.join(process.cwd(), 'src/lib/scripting/worker-script.mjs')

const pool = new Piscina({
  filename: WORKER_FILE,
  maxThreads: 4,
  idleTimeout: 60_000,
})

function emptyMutations(): ScriptMutations {
  return { local: {}, environment: {}, collection: {}, global: {}, requestMutations: { headers: {} } }
}

// ── executeScript ──────────────────────────────────────────────────────────

export async function executeScript(
  script: string,
  ctx: ScriptContext,
  responseForPostScript?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    durationMs: number
  }
): Promise<ScriptResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SCRIPT_TIMEOUT_MS)

  try {
    const result = await pool.run(
      { script, ctx, responseForPostScript },
      { signal: controller.signal }
    )
    return result as ScriptResult
  } catch (err: unknown) {
    const isTimeout = controller.signal.aborted ||
      (err instanceof Error && err.message.includes('aborted'))
    const error = isTimeout
      ? 'Script execution timed out (10s)'
      : (err instanceof Error ? err.message : String(err))
    logger.warn({ error }, 'Script execution error')
    return { mutations: emptyMutations(), tests: [], logs: [], error }
  } finally {
    clearTimeout(timer)
  }
}
