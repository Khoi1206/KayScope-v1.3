import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { generateFlowSpec } from '@/lib/codegen/flow-playwright'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace')
    const flow = await findFlowByIdForWorkspace(id, workspace.id)
    if (!flow) throw new NotFoundError('Flow')

    const spec = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges })
    const safeName = flow.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()

    return new NextResponse(spec, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.spec.ts"`,
      },
    })
  })
}
