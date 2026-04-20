import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { getHistory } from '@/db/queries/history'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')

    const cursorParam = req.nextUrl.searchParams.get('cursor')
    const cursor = cursorParam ? JSON.parse(decodeURIComponent(cursorParam)) : undefined

    const result = await getHistory(workspace.id, { cursor })
    return NextResponse.json(result)
  })
}
