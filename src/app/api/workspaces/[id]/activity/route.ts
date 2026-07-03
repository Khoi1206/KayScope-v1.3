import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { getEffectiveRole } from '@/lib/auth/workspace-guard'
import { findActivityLogsByWorkspace } from '@/db/queries/activity_logs'
import { withErrorHandler } from '@/lib/api/respond'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

/** GET /api/workspaces/[id]/activity — recent audit-log entries; any member can view */
export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, session.user.id)
    if (!role) throw new ForbiddenError('Workspace not found or access denied')

    const limitParam = req.nextUrl.searchParams.get('limit')
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 100
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 100

    const logs = await findActivityLogsByWorkspace(id, limit)
    return NextResponse.json(logs)
  })
}
