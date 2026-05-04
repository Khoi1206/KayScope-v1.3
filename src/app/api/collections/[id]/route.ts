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
import { maskVariables, encryptVariables } from '@/lib/execute/variable-crypto'

type Params = { params: { id: string } }

export function GET(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const col = await findCollectionByIdForWorkspace(params.id, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    return NextResponse.json({ ...col, variables: maskVariables(col.variables) })
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

    const updateData: Parameters<typeof updateCollection>[1] = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.variables) {
      updateData.variables = encryptVariables(parsed.data.variables, col.variables)
    }

    const updated = await updateCollection(params.id, updateData)
    if (!updated) throw new NotFoundError('Collection not found')
    return NextResponse.json({ ...updated, variables: maskVariables(updated.variables) })
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
