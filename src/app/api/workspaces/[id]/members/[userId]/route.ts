import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { getEffectiveRole, roleAtLeast } from '@/lib/auth/workspace-guard'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { findUserById } from '@/db/queries/users'
import { updateMemberRole, removeMember } from '@/db/queries/workspace_members'
import { logActivity } from '@/db/queries/activity_logs'
import { updateMemberRoleSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: Promise<{ id: string; userId: string }> }

/** PATCH /api/workspaces/[id]/members/[userId] — change a member's role; admin or owner only */
export function PATCH(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id, userId } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role || !roleAtLeast(role, 'admin')) throw new ForbiddenError('Insufficient workspace role')
    if (userId === ws.ownerId) throw new ForbiddenError("Cannot change the workspace owner's role")

    const body = await req.json()
    const parsed = updateMemberRoleSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const updated = await updateMemberRole(id, userId, parsed.data.role)
    if (!updated) throw new NotFoundError('Membership')

    const targetUser = await findUserById(userId)
    await logActivity({
      workspaceId: id,
      actorId: session.user.id,
      action: 'updated',
      entityType: 'member',
      entityId: userId,
      entityName: targetUser?.email ?? userId,
      metadata: { newRole: parsed.data.role },
    })
    return NextResponse.json(updated)
  })
}

/** DELETE /api/workspaces/[id]/members/[userId] — remove a member; admin or owner only */
export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id, userId } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role || !roleAtLeast(role, 'admin')) throw new ForbiddenError('Insufficient workspace role')
    if (userId === ws.ownerId) throw new ForbiddenError('Cannot remove the workspace owner')

    const targetUser = await findUserById(userId)
    await removeMember(id, userId)
    await logActivity({
      workspaceId: id,
      actorId: session.user.id,
      action: 'deleted',
      entityType: 'member',
      entityId: userId,
      entityName: targetUser?.email ?? userId,
    })
    return NextResponse.json({ success: true })
  })
}
