import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { generateFlowSpec } from '@/lib/codegen/flow-playwright'

const GENERATED_DIR = path.join(process.cwd(), 'tests', 'e2e', 'generated')
// Normalize to forward slashes — Windows backslashes break Playwright's CLI path parser
const BUILDER_CONFIG = path.join(process.cwd(), 'playwright.builder.config.ts').replace(/\\/g, '/')

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'UI runner is disabled in production' }, { status: 403 })
  }

  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const workspace = await findWorkspaceByOwner(session.user.id)
  if (!workspace) return NextResponse.json({ ok: false, error: 'Workspace not found' }, { status: 404 })

  const flow = await findFlowByIdForWorkspace(id, workspace.id)
  if (!flow) return NextResponse.json({ ok: false, error: 'Flow not found' }, { status: 404 })

  try {
    // Generate and write the spec file
    const specContent = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges })
    await mkdir(GENERATED_DIR, { recursive: true })
    const specFile = path.join(GENERATED_DIR, `flow-${flow.id}.spec.ts`)
    await writeFile(specFile, specContent, 'utf8')

    // Launch Playwright UI in a detached process — fire and forget.
    // On Windows, use "cmd /c start /B" to detach the process so the API
    // returns immediately while Playwright opens its Electron window.
    const cmd =
      process.platform === 'win32'
        ? `cmd /c start "" /B npx playwright test --ui --config="${BUILDER_CONFIG}"`
        : `npx playwright test --ui --config="${BUILDER_CONFIG}"`

    exec(cmd, { cwd: process.cwd(), windowsHide: false })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
