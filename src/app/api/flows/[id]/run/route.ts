import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { createFlowRun } from '@/db/queries/flow_runs'
import { executeFlowRun } from '@/lib/execute/flow-runner'
import { enqueueFlowRun, startFlowRunWorkers } from '@/lib/execute/flow-run-queue'
import logger from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await requireWorkspaceRole(req, session.user.id, 'editor').catch(() => null)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const flow = await findFlowByIdForWorkspace(id, workspace.id)
  if (!flow) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })

  const run = await createFlowRun({
    workspaceId: workspace.id,
    flowId: flow.id,
    flowName: flow.name,
    triggeredBy: session.user.id,
  })

  // Production: hand off to the bounded-concurrency Redis queue (flow-run-queue.ts)
  // instead of running inline — protects the same process serving HTTP requests
  // from a burst of "Run Flow" clicks forking unbounded Playwright processes.
  // The client polls GET /api/flow-runs/[id] until status leaves 'running'.
  if (process.env.NODE_ENV === 'production') {
    try {
      startFlowRunWorkers()
      await enqueueFlowRun(run.id)
      return NextResponse.json({ run, queued: true })
    } catch (err) {
      logger.error(err, 'Flow run: failed to enqueue')
      return NextResponse.json({ error: 'Failed to queue flow run' }, { status: 500 })
    }
  }

  // Dev: run inline and wait for the result, same as before.
  try {
    const { run: finalRun, testResults } = await executeFlowRun(flow, run)
    return NextResponse.json({ run: finalRun, testResults })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Run failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
