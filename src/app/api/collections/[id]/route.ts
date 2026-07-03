import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace, updateCollection, deleteCollection } from '@/db/queries/collections'
import { logActivity } from '@/db/queries/activity_logs'
import { updateCollectionSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { maskVariables, encryptVariables } from '@/lib/execute/variable-crypto'

type Params = { params: { id: string } }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const col = await findCollectionByIdForWorkspace(params.id, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    return NextResponse.json({ ...col, variables: maskVariables(col.variables) })
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
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
    if (parsed.data.preRequestScript !== undefined) updateData.preRequestScript = parsed.data.preRequestScript
    if (parsed.data.postRequestScript !== undefined) updateData.postRequestScript = parsed.data.postRequestScript

    const updated = await updateCollection(params.id, updateData)
    if (!updated) throw new NotFoundError('Collection not found')
    if (parsed.data.name !== undefined && parsed.data.name !== col.name) {
      await logActivity({
        workspaceId: workspace.id,
        actorId: session.user.id,
        action: 'renamed',
        entityType: 'collection',
        entityId: updated.id,
        entityName: updated.name,
        metadata: { previousName: col.name },
      })
    }
    return NextResponse.json({ ...updated, variables: maskVariables(updated.variables) })
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const col = await findCollectionByIdForWorkspace(params.id, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    await deleteCollection(params.id)
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'deleted',
      entityType: 'collection',
      entityId: col.id,
      entityName: col.name,
    })
    return NextResponse.json({ success: true })
  })
}
