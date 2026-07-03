import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { createFlowVersion, findFlowVersionsByFlow } from '@/db/queries/flow_versions'
import { createFlowVersionSchema, flowVersionsQuerySchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const flow = await findFlowByIdForWorkspace(id, workspace.id)
    if (!flow) throw new NotFoundError('Flow')

    const parsedQuery = flowVersionsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    const limit = parsedQuery.success ? parsedQuery.data.limit : 20

    const versions = await findFlowVersionsByFlow(id, limit)
    return NextResponse.json(versions)
  })
}

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const flow = await findFlowByIdForWorkspace(id, workspace.id)
    if (!flow) throw new NotFoundError('Flow')

    const body = await req.json()
    const parsed = createFlowVersionSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    // The client sends its current in-editor nodes/edges rather than us re-reading
    // `flows` — the debounced autosave may not have flushed yet, so reading from
    // the client avoids snapshotting a stale canvas.
    const version = await createFlowVersion({
      workspaceId: workspace.id,
      flowId: id,
      label: parsed.data.label,
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
      createdBy: session.user.id,
    })
    return NextResponse.json(version)
  })
}
