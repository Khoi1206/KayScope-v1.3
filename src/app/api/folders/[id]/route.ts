import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findFolderById, updateFolder, deleteFolder } from '@/db/queries/folders'
import { logActivity } from '@/db/queries/activity_logs'
import { updateFolderSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors'

type Params = { params: { id: string } }

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const folder = await findFolderById(params.id)
    if (!folder) throw new NotFoundError('Folder not found')
    const col = await findCollectionByIdForWorkspace(folder.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    const body = await req.json()
    const parsed = updateFolderSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const updated = await updateFolder(params.id, parsed.data)
    if (parsed.data.name !== undefined && parsed.data.name !== folder.name && updated) {
      await logActivity({
        workspaceId: workspace.id,
        actorId: session.user.id,
        action: 'renamed',
        entityType: 'folder',
        entityId: updated.id,
        entityName: updated.name,
        metadata: { previousName: folder.name },
      })
    }
    return NextResponse.json(updated)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const folder = await findFolderById(params.id)
    if (!folder) throw new NotFoundError('Folder not found')
    const col = await findCollectionByIdForWorkspace(folder.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    await deleteFolder(params.id, folder.collectionId)
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'deleted',
      entityType: 'folder',
      entityId: folder.id,
      entityName: folder.name,
    })
    return NextResponse.json({ success: true })
  })
}
