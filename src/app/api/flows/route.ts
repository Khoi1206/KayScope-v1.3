import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findFlowsByWorkspace, createFlow } from '@/db/queries/flows'
import { createFlowSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

export function GET() {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace')
    const flowList = await findFlowsByWorkspace(workspace.id)
    return NextResponse.json(flowList)
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace')
    const body = await req.json()
    const parsed = createFlowSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const flow = await createFlow(workspace.id, {
      ...parsed.data,
      createdBy: session.user.id,
    })
    return NextResponse.json(flow, { status: 201 })
  })
}
