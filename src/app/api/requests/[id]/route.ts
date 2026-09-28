import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findRequestById, updateRequest, deleteRequest } from '@/db/queries/requests'
import { logActivity } from '@/db/queries/activity_logs'
import { updateRequestSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors'

type Params = { params: { id: string } }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const request = await findRequestById(params.id)
    if (!request) throw new NotFoundError('Request')
    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    return NextResponse.json(request)
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const request = await findRequestById(params.id)
    if (!request) throw new NotFoundError('Request')
    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    const body = await req.json()
    const parsed = updateRequestSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const updated = await updateRequest(params.id, parsed.data)
    if (parsed.data.name !== undefined && parsed.data.name !== request.name && updated) {
      await logActivity({
        workspaceId: workspace.id,
        actorId: session.user.id,
        action: 'renamed',
        entityType: 'request',
        entityId: updated.id,
        entityName: updated.name,
        metadata: { previousName: request.name },
      })
    }
    return NextResponse.json(updated)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const request = await findRequestById(params.id)
    if (!request) throw new NotFoundError('Request')
    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    await deleteRequest(params.id)
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'deleted',
      entityType: 'request',
      entityId: request.id,
      entityName: request.name,
    })
    return NextResponse.json({ success: true })
  })
}
