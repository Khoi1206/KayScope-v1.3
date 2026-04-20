import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import {
  findCollectionByIdForWorkspace,
  updateCollection,
  deleteCollection,
} from '@/db/queries/collections'
import { updateCollectionSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: { id: string } }

export function GET(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const col = await findCollectionByIdForWorkspace(params.id, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    return NextResponse.json(col)
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const col = await findCollectionByIdForWorkspace(params.id, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    const body = await req.json()
    const parsed = updateCollectionSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const updated = await updateCollection(params.id, parsed.data)
    return NextResponse.json(updated)
  })
}

export function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const col = await findCollectionByIdForWorkspace(params.id, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    await deleteCollection(params.id)
    return NextResponse.json({ success: true })
  })
}
