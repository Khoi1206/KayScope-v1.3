import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findRequestById, updateRequest } from '@/db/queries/requests'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findRequestVersionByIdForWorkspace } from '@/db/queries/request_versions'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

type Params = { params: Promise<{ id: string; versionId: string }> }

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id, versionId } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')

    const request = await findRequestById(id)
    if (!request) throw new NotFoundError('Request')
    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')

    const version = await findRequestVersionByIdForWorkspace(versionId, workspace.id)
    if (!version || version.requestId !== id) throw new NotFoundError('Request version')

    const updated = await updateRequest(id, {
      method: version.method,
      url: version.url,
      params: version.params,
      headers: version.headers,
      body: version.body,
      auth: version.auth,
      preRequestScript: version.preRequestScript,
      postRequestScript: version.postRequestScript,
    })
    return NextResponse.json(updated)
  })
}
