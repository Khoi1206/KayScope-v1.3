import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { findFlowRunsByFlow } from '@/db/queries/flow_runs'
import { flowRunsQuerySchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace')
    const flow = await findFlowByIdForWorkspace(id, workspace.id)
    if (!flow) throw new NotFoundError('Flow')
    const query = flowRunsQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams))
    const limit = query.success ? query.data.limit : 10
    const runs = await findFlowRunsByFlow(id, limit)
    return NextResponse.json(runs)
  })
}
