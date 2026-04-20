import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findFoldersByCollection, createFolder } from '@/db/queries/folders'
import { createFolderSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const collectionId = req.nextUrl.searchParams.get('collectionId')
    if (!collectionId) throw new ValidationError('collectionId query param required')
    const col = await findCollectionByIdForWorkspace(collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    const items = await findFoldersByCollection(collectionId)
    return NextResponse.json(items)
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const body = await req.json()
    const parsed = createFolderSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const col = await findCollectionByIdForWorkspace(parsed.data.collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    const folder = await createFolder(parsed.data)
    return NextResponse.json(folder, { status: 201 })
  })
}
