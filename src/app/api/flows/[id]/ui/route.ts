import { NextRequest, NextResponse } from 'next/server'
import { spawn, execSync } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
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

// In-memory registry of live "Test UI" processes, keyed by flow id — the
// single source of truth while this Node process is alive.
const uiSessions = new Map<string, { pid: number; startedAt: number }>()

// Mirrored to disk so a dev-server restart doesn't orphan a running Playwright
// UI process with no way to track/stop it — one small JSON file per flow id,
// written on spawn and removed on exit/stop. On module load (i.e. server
// start), the directory is scanned and any session whose pid is still alive
// is adopted back into `uiSessions`; dead ones are just stale files, removed.
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

function persistSession(flowId: string, pid: number, startedAt: number) {
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true })
    writeFileSync(sessionFilePath(flowId), JSON.stringify({ pid, startedAt }), 'utf8')
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
      const { pid, startedAt } = JSON.parse(readFileSync(path.join(SESSIONS_DIR, file), 'utf8')) as { pid: number; startedAt: number }
      if (isPidAlive(pid)) {
        uiSessions.set(flowId, { pid, startedAt })
      } else {
        unlinkSync(path.join(SESSIONS_DIR, file))
      }
    } catch (err) {
      logger.warn(err, `Flow UI: failed to parse stale session file ${file}`)
    }
  }
}

loadPersistedSessions()

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

/** Kills the whole process tree rooted at `pid` — the tracked pid is a shell (cmd.exe / sh) wrapping npx. */
function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' })
  } else {
    process.kill(-pid, 'SIGTERM')
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: 'Playwright UI mode requires a local dev environment (Electron GUI, no headless server support) — run "npx playwright test --ui" on your machine instead.' },
      { status: 403 }
    )
  }

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

  try {
    // Generate and write the spec file — resolve {{variable}} tokens against the
    // flow's bound environment + workspace globals, same as the run route.
    const { scopes, dynamicVars } = await loadFlowScopes(flow)
    const specContent = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges, scopes, dynamicVars })
    await mkdir(GENERATED_DIR, { recursive: true })
    const specFile = path.join(GENERATED_DIR, `flow-${flow.id}.spec.ts`)
    await writeFile(specFile, specContent, 'utf8')

    const projectFlags = flow.browsers.map(b => `--project=${b}`)
    const args = ['playwright', 'test', '--ui', ...projectFlags, '--config', BUILDER_CONFIG]

    // spawn (not exec) so we keep a real, killable pid. shell:true lets Windows
    // resolve npx.cmd; on POSIX, detached:true makes the shell its own process
    // group leader so killProcessTree can signal the whole tree via -pid.
    const child = spawn('npx', args, {
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
    uiSessions.set(flow.id, { pid: child.pid, startedAt })
    persistSession(flow.id, child.pid, startedAt)
    child.once('exit', () => {
      uiSessions.delete(flow.id)
      removePersistedSession(flow.id)
    })
    child.once('error', (err) => {
      logger.warn(err, 'Flow UI process error')
      uiSessions.delete(flow.id)
      removePersistedSession(flow.id)
    })
    child.unref()

    return NextResponse.json({ ok: true, pid: child.pid })
  } catch (err) {
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
    killProcessTree(session.pid)
  } catch (err) {
    logger.warn(err, 'Flow UI: failed to kill process tree')
  } finally {
    uiSessions.delete(flow.id)
    removePersistedSession(flow.id)
  }

  return NextResponse.json({ ok: true })
}
