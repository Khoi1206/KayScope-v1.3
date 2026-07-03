import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspaceAny } from '@/db/queries/collections'
import { findDeletedRequestById, restoreRequest } from '@/db/queries/requests'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

type Params = { params: { id: string } }

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const request = await findDeletedRequestById(params.id)
    if (!request) throw new NotFoundError('Request not found')
    const col = await findCollectionByIdForWorkspaceAny(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')
    const restored = await restoreRequest(params.id)
    return NextResponse.json(restored)
  })
}
