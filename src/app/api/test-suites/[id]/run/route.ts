import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findTestSuiteByIdForWorkspace } from '@/db/queries/test_suites'
import { createTestRun, finalizeTestRun } from '@/db/queries/test_runs'
import { runCollection } from '@/lib/execute/runner'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await findWorkspaceByOwner(session.user.id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const suite = await findTestSuiteByIdForWorkspace(id, workspace.id)
  if (!suite) return NextResponse.json({ error: 'Test suite not found' }, { status: 404 })

  // Fetch current collection name at run time (snapshot for history)
  const collection = await findCollectionByIdForWorkspace(suite.collectionId, workspace.id)
  if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const run = await createTestRun({
    workspaceId: workspace.id,
    testSuiteId: suite.id,
    collectionId: suite.collectionId,
    collectionName: collection.name,
    environmentId: suite.environmentId ?? undefined,
    triggeredBy: session.user.id,
  })

  try {
    const result = await runCollection(
      {
        collectionId: suite.collectionId,
        workspaceId: workspace.id,
        environmentId: suite.environmentId ?? undefined,
        dataRows: suite.dataRows as Record<string, string>[],
      },
      session.user.id
    )

    const failed = result.summary.failed > 0 || result.summary.errored > 0
    const status = failed ? 'failed' : 'passed'

    const finalRun = await finalizeTestRun(run.id, {
      iterations: result.iterations,
      summary: result.summary,
      status,
    })

    return NextResponse.json({ run: finalRun, result })
  } catch (err) {
    await finalizeTestRun(run.id, {
      iterations: [],
      summary: { totalRequests: 0, totalIterations: 0, passed: 0, failed: 0, errored: 0, totalDurationMs: 0 },
      status: 'errored',
    })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Run failed' },
      { status: 500 }
    )
  }
}
