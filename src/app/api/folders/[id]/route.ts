import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findFolderById, updateFolder, deleteFolder } from '@/db/queries/folders'
import { updateFolderSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors'

type Params = { params: { id: string } }

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const folder = await findFolderById(params.id)
    if (!folder) throw new NotFoundError('Folder not found')
    const col = await findCollectionByIdForWorkspace(folder.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    const body = await req.json()
    const parsed = updateFolderSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const updated = await updateFolder(params.id, parsed.data)
    return NextResponse.json(updated)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const folder = await findFolderById(params.id)
    if (!folder) throw new NotFoundError('Folder not found')
    const col = await findCollectionByIdForWorkspace(folder.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    await deleteFolder(params.id)
    return NextResponse.json({ success: true })
  })
}
