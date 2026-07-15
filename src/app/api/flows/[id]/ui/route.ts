import { NextRequest, NextResponse } from 'next/server'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { createServer as createNetServer } from 'net'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import path from 'path'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { generateFlowSpec } from '@/lib/codegen/flow-playwright'
import { loadFlowScopes } from '@/lib/codegen/flow-scopes'
import logger from '@/lib/logger'

const GENERATED_DIR = path.join(process.cwd(), 'tests', 'e2e', 'generated')
// Normalize to forward slashes — Windows backslashes break Playwright's CLI path parser
const BUILDER_CONFIG = path.join(process.cwd(), 'playwright.builder.config.ts').replace(/\\/g, '/')

type UiSession = { pid: number; startedAt: number; port: number }

// In-memory registry of live "Test UI" processes, keyed by flow id — the
// single source of truth while this Node process is alive.
const uiSessions = new Map<string, UiSession>()

const SESSIONS_DIR = path.join(GENERATED_DIR, '.ui-sessions')

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sessionFilePath(flowId: string) {
  return path.join(SESSIONS_DIR, `${flowId}.json`)
}

function persistSession(flowId: string, session: UiSession) {
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true })
    writeFileSync(sessionFilePath(flowId), JSON.stringify(session), 'utf8')
  } catch (err) {
    logger.warn(err, 'Flow UI: failed to persist session file')
  }
}

function removePersistedSession(flowId: string) {
  try {
    unlinkSync(sessionFilePath(flowId))
  } catch {
    // Already gone — fine
  }
}

function loadPersistedSessions() {
  let files: string[]
  try {
    files = readdirSync(SESSIONS_DIR)
  } catch {
    return // Directory doesn't exist yet — nothing to adopt
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const flowId = file.slice(0, -'.json'.length)
    try {
      const session = JSON.parse(readFileSync(path.join(SESSIONS_DIR, file), 'utf8')) as Partial<UiSession>
      if (session.pid && isPidAlive(session.pid) && session.port) {
        uiSessions.set(flowId, session as UiSession)
      } else {
        unlinkSync(path.join(SESSIONS_DIR, file))
      }
    } catch (err) {
      logger.warn(err, `Flow UI: failed to parse stale session file ${file}`)
    }
  }
}

loadPersistedSessions()

/** Binds to port 0 to ask the OS for a free ephemeral port, then releases it immediately. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => (port ? resolve(port) : reject(new Error('Could not determine a free port'))))
    })
  })
}

/** Polls the Playwright ui-host server until it accepts connections, or gives up. */
async function waitForUiServer(port: number, timeoutMs = 60000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) })
      if (res.ok || res.status < 500) return true
    } catch {
      // Not up yet — keep polling
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return false
}

type Params = { params: Promise<{ id: string }> }

async function authorize(req: NextRequest, id: string, min?: 'editor') {
  const session = await requireSession().catch(() => null)
  if (!session) return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) } as const

  const workspace = await (min
    ? requireWorkspaceRole(req, session.user.id, min)
    : requireActiveWorkspace(req, session.user.id)
  ).catch(() => null)
  if (!workspace) return { error: NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 }) } as const

  const flow = await findFlowByIdForWorkspace(id, workspace.id)
  if (!flow) return { error: NextResponse.json({ ok: false, error: 'Flow not found' }, { status: 404 }) } as const

  return { flow } as const
}

const execFileAsync = promisify(execFile)

/**
 * Kills the whole process tree rooted at `pid` — the tracked pid is a shell
 * (cmd.exe / sh) wrapping npx. Uses execFile (not execSync) on Windows so a
 * "Stop UI" click doesn't block the Node event loop — and therefore every
 * other user's concurrent request — for the duration of the taskkill call.
 */
async function killProcessTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/pid', String(pid), '/T', '/F'])
  } else {
    process.kill(-pid, 'SIGTERM')
  }
}

/** Removes the generated spec file — it contains decrypted secret values resolved server-side, so it must not linger on disk after the UI session ends. */
function removeSpecFile(flowId: string) {
  unlink(path.join(GENERATED_DIR, `flow-${flowId}.spec.ts`)).catch(() => {})
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const authed = await authorize(req, id, 'editor')
  if ('error' in authed) return authed.error
  const { flow } = authed

  const existing = uiSessions.get(flow.id)
  if (existing) {
    return NextResponse.json(
      { ok: false, error: 'Playwright UI is already running for this flow. Stop it before starting a new session.', alreadyRunning: true },
      { status: 409 }
    )
  }

  let child: ReturnType<typeof spawn> | undefined
  try {
    // Generate and write the spec file — resolve {{variable}} tokens against the
    // flow's bound environment + workspace globals, same as the run route.
    const { scopes, dynamicVars } = await loadFlowScopes(flow)
    const specContent = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges, scopes, dynamicVars })
    await mkdir(GENERATED_DIR, { recursive: true })
    const specFile = path.join(GENERATED_DIR, `flow-${flow.id}.spec.ts`)
    await writeFile(specFile, specContent, 'utf8')

    const projectFlags = flow.browsers.map(b => `--project=${b}`).join(' ')
    const port = await getFreePort()

    // spawn (not exec) so we keep a real, killable pid. shell:true lets Windows
    // resolve npx.cmd; on POSIX, detached:true makes the shell its own process
    // group leader so killProcessTree can signal the whole tree via -pid.
    //
    // --ui-host/--ui-port run UI mode as a plain HTTP+WebSocket server instead of
    // launching an Electron/Chrome-app window — the window approach can't run on a
    // headless server, and can't be embedded in our own page either way. server.ts's
    // /flow-ui-proxy/:flowId reverse proxy forwards to this port (see SESSIONS_DIR).
    //
    // Command is built as a single string, NOT an args array — with shell:true on
    // Windows, Node joins array elements with a bare space and does NOT quote them
    // (see Node's DEP0190). BUILDER_CONFIG's absolute path can contain spaces (e.g.
    // a project directory like "KayScope v1.3"), which silently split into two argv
    // tokens, made Playwright's config resolver 404, and the process exited near-
    // instantly — invisible because stdio was 'ignore'. Quoting the path ourselves
    // in one command string (same pattern as flow-runner.ts's execAsync call) avoids it.
    const command = `npx playwright test --ui-host=127.0.0.1 --ui-port=${port} ${projectFlags} --config="${BUILDER_CONFIG}"`
    child = spawn(command, {
      cwd: process.cwd(),
      shell: true,
      detached: process.platform !== 'win32',
      windowsHide: false,
      stdio: 'ignore',
    })

    if (!child.pid) {
      return NextResponse.json({ ok: false, error: 'Failed to launch Playwright UI' }, { status: 500 })
    }

    const startedAt = Date.now()
    const session: UiSession = { pid: child.pid, startedAt, port }
    uiSessions.set(flow.id, session)
    persistSession(flow.id, session)
    child.once('exit', () => {
      uiSessions.delete(flow.id)
      removePersistedSession(flow.id)
      removeSpecFile(flow.id)
    })
    child.once('error', (err) => {
      logger.warn(err, 'Flow UI process error')
      uiSessions.delete(flow.id)
      removePersistedSession(flow.id)
      removeSpecFile(flow.id)
    })
    child.unref()

    const ready = await waitForUiServer(port)
    if (!ready) {
      try { await killProcessTree(child.pid) } catch { /* best-effort */ }
      uiSessions.delete(flow.id)
      removePersistedSession(flow.id)
      removeSpecFile(flow.id)
      return NextResponse.json({ ok: false, error: 'Playwright UI did not start in time' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, pid: child.pid })
  } catch (err) {
    if (child?.pid) {
      try { await killProcessTree(child.pid) } catch { /* best-effort */ }
      uiSessions.delete(flow.id)
      removePersistedSession(flow.id)
      removeSpecFile(flow.id)
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const authed = await authorize(req, id)
  if ('error' in authed) return authed.error

  const session = uiSessions.get(authed.flow.id)
  return NextResponse.json({ running: Boolean(session), startedAt: session?.startedAt ?? null })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params

  const authed = await authorize(req, id, 'editor')
  if ('error' in authed) return authed.error
  const { flow } = authed

  const session = uiSessions.get(flow.id)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'No running UI session for this flow' }, { status: 404 })
  }

  try {
    await killProcessTree(session.pid)
  } catch (err) {
    logger.warn(err, 'Flow UI: failed to kill process tree')
  } finally {
    uiSessions.delete(flow.id)
    removePersistedSession(flow.id)
    removeSpecFile(flow.id)
  }

  return NextResponse.json({ ok: true })
}
