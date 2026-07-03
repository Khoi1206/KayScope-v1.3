import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findFlowByIdForWorkspace, updateFlow, deleteFlow } from '@/db/queries/flows'
import { logActivity } from '@/db/queries/activity_logs'
import { updateFlowSchema } from '@/schemas'
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
    return NextResponse.json(flow)
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const flow = await findFlowByIdForWorkspace(id, workspace.id)
    if (!flow) throw new NotFoundError('Flow')
    const body = await req.json()
    const parsed = updateFlowSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const updated = await updateFlow(id, parsed.data)
    if (parsed.data.name !== undefined && parsed.data.name !== flow.name && updated) {
      await logActivity({
        workspaceId: workspace.id,
        actorId: session.user.id,
        action: 'renamed',
        entityType: 'flow',
        entityId: updated.id,
        entityName: updated.name,
        metadata: { previousName: flow.name },
      })
    }
    return NextResponse.json(updated)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const flow = await findFlowByIdForWorkspace(id, workspace.id)
    if (!flow) throw new NotFoundError('Flow')
    await deleteFlow(id)
    // Remove generated spec file if it exists (fire-and-forget, ignore ENOENT)
    const specFile = path.join(process.cwd(), 'tests', 'e2e', 'generated', `flow-${id}.spec.ts`)
    unlink(specFile).catch(() => {})
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'deleted',
      entityType: 'flow',
      entityId: flow.id,
      entityName: flow.name,
    })
    return NextResponse.json({ success: true })
  })
}
