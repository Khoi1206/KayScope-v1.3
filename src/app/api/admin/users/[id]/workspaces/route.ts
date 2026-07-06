import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { findUserById } from '@/db/queries/users'
import { findAllWorkspacesByOwner, findAllWorkspacesByMembership } from '@/db/queries/workspaces'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: { id: string } }

/** GET /api/admin/users/[id]/workspaces — workspaces this user owns or is a member of (admin CMS only) */
export function GET(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    await requireAdmin()

    const target = await findUserById(params.id)
    if (!target) throw new NotFoundError('User not found')

    const [owned, member] = await Promise.all([
      findAllWorkspacesByOwner(params.id),
      findAllWorkspacesByMembership(params.id),
    ])
    const workspaces = [
      ...owned.map(w => ({ ...w, role: 'owner' as const })),
      ...member,
    ]
    return NextResponse.json(workspaces)
  })
}
