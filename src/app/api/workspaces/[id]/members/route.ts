import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { getEffectiveRole, roleAtLeast } from '@/lib/auth/workspace-guard'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { findUserByEmail } from '@/db/queries/users'
import { findMembersByWorkspace, findMembership, addMember } from '@/db/queries/workspace_members'
import { logActivity } from '@/db/queries/activity_logs'
import { inviteMemberSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

/** GET /api/workspaces/[id]/members — any member (or the owner) can view the roster */
export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role) throw new ForbiddenError('Workspace not found or access denied')

    const members = await findMembersByWorkspace(id)
    return NextResponse.json(members)
  })
}

/** POST /api/workspaces/[id]/members — invite an existing user by email; admin or owner only */
export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role || !roleAtLeast(role, 'admin')) throw new ForbiddenError('Insufficient workspace role')

    const body = await req.json()
    const parsed = inviteMemberSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const user = await findUserByEmail(parsed.data.email)
    if (!user) throw new ValidationError('No KayScope account found for that email — they must register first')

    if (user.id === ws.ownerId) throw new ConflictError('This user already owns the workspace')
    const existing = await findMembership(id, user.id)
    if (existing) throw new ConflictError('This user is already a member of the workspace')

    const member = await addMember({
      workspaceId: id,
      userId: user.id,
      role: parsed.data.role,
      invitedBy: session.user.id,
    })
    await logActivity({
      workspaceId: id,
      actorId: session.user.id,
      action: 'created',
      entityType: 'member',
      entityId: user.id,
      entityName: user.email,
      metadata: { role: parsed.data.role },
    })
    return NextResponse.json(member, { status: 201 })
  })
}
