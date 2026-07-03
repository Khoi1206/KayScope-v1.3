import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import {
  findWorkspaceById,
  findWorkspaceByIdAndOwner,
  updateWorkspace,
  deleteWorkspace,
  countWorkspacesByOwner,
} from '@/db/queries/workspaces'
import { getEffectiveRole, roleAtLeast } from '@/lib/auth/workspace-guard'
import { patchWorkspaceSchema, updateWorkspaceSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { maskVariables, encryptVariables } from '@/lib/execute/variable-crypto'

type Params = { params: Promise<{ id: string }> }

/** GET /api/workspaces/[id] — full workspace (global vars masked); any member can view */
export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role) throw new ForbiddenError('Workspace not found or access denied')
    return NextResponse.json({
      ...ws,
      globalVariables: maskVariables(ws.globalVariables),
    })
  })
}

/** PATCH /api/workspaces/[id] — rename / change type / update description; admin or owner */
export function PATCH(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role || !roleAtLeast(role, 'admin')) throw new ForbiddenError('Insufficient workspace role')

    const body = await req.json()
    const parsed = patchWorkspaceSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const updated = await updateWorkspace(id, {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.type !== undefined && { type: parsed.data.type }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    })
    if (!updated) throw new NotFoundError('Workspace')

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      description: updated.description,
      createdAt: updated.createdAt,
    })
  })
}

/** PUT /api/workspaces/[id] — update global variables; admin or owner */
export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role || !roleAtLeast(role, 'admin')) throw new ForbiddenError('Insufficient workspace role')

    const body = await req.json()
    const parsed = updateWorkspaceSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const updateData: Parameters<typeof updateWorkspace>[1] = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.activeEnvironmentId !== undefined) updateData.activeEnvironmentId = parsed.data.activeEnvironmentId
    if (parsed.data.globalVariables) {
      updateData.globalVariables = encryptVariables(parsed.data.globalVariables, ws.globalVariables)
    }

    const updated = await updateWorkspace(id, updateData)
    if (!updated) throw new NotFoundError('Workspace')

    return NextResponse.json({
      ...updated,
      globalVariables: maskVariables(updated.globalVariables),
    })
  })
}

/** DELETE /api/workspaces/[id] — delete; blocked if it's the user's last workspace */
export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceByIdAndOwner(id, session.user.id)
    if (!ws) throw new NotFoundError('Workspace')

    const count = await countWorkspacesByOwner(session.user.id)
    if (count <= 1) throw new ConflictError('Cannot delete your last workspace')

    await deleteWorkspace(id, session.user.id)
    return NextResponse.json({ success: true })
  })
}
