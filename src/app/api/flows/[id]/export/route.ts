import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findFlowByIdForWorkspace } from '@/db/queries/flows'
import { generateFlowSpec } from '@/lib/codegen/flow-playwright'
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

    let spec: string
    try {
      spec = generateFlowSpec({ name: flow.name, nodes: flow.nodes, edges: flow.edges })
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Failed to generate flow spec')
    }
    const safeName = flow.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()

    return new NextResponse(spec, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.spec.ts"`,
      },
    })
  })
}
