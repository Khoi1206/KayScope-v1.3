import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { runnerSchema } from '@/schemas'
import { runCollection } from '@/lib/execute/runner'

export async function POST(req: NextRequest) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = runnerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 422 })
  }

  const workspace = await requireWorkspaceRole(req, session.user.id, 'editor').catch(() => null)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  try {
    const result = await runCollection(
      {
        collectionId: parsed.data.collectionId,
        workspaceId: workspace.id,
        environmentId: parsed.data.environmentId,
        dataRows: parsed.data.dataRows,
      },
      session.user.id
    )
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Runner failed' },
      { status: 500 }
    )
  }
}
