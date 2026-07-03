import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findFlowsByWorkspace, createFlow } from '@/db/queries/flows'
import { logActivity } from '@/db/queries/activity_logs'
import { createFlowSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const flowList = await findFlowsByWorkspace(workspace.id)
    return NextResponse.json(flowList)
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const body = await req.json()
    const parsed = createFlowSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const flow = await createFlow(workspace.id, {
      ...parsed.data,
      createdBy: session.user.id,
    })
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'created',
      entityType: 'flow',
      entityId: flow.id,
      entityName: flow.name,
    })
    return NextResponse.json(flow, { status: 201 })
  })
}
