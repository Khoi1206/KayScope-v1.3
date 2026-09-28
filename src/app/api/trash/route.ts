import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findDeletedCollectionsByWorkspace, findCollectionByIdForWorkspaceAny, purgeCollection, findCollectionsByWorkspace } from '@/db/queries/collections'
import { findDeletedRequestsByCollectionIds, findDeletedRequestById, purgeRequest } from '@/db/queries/requests'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ForbiddenError, ValidationError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)

    const [deletedCollections, activeCollections] = await Promise.all([
      findDeletedCollectionsByWorkspace(workspace.id),
      findCollectionsByWorkspace(workspace.id),
    ])
    // Requests can be soft-deleted individually even while their collection stays active —
    // check both active and deleted collections so those still show up in Trash.
    const allCollectionIds = [...deletedCollections, ...activeCollections].map(c => c.id)
    const deletedRequests = await findDeletedRequestsByCollectionIds(allCollectionIds)

    return NextResponse.json({
      collections: deletedCollections.map(c => ({ id: c.id, name: c.name, deletedAt: c.deletedAt })),
      requests: deletedRequests.map(r => ({ id: r.id, name: r.name, collectionId: r.collectionId, deletedAt: r.deletedAt })),
    })
  })
}

const purgeSchema = { collection: 'collection', request: 'request' } as const

export function DELETE(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const type = req.nextUrl.searchParams.get('type')
    const id = req.nextUrl.searchParams.get('id')
    if (!id || (type !== purgeSchema.collection && type !== purgeSchema.request)) {
      throw new ValidationError('type (collection|request) and id query params are required')
    }

    if (type === 'collection') {
      const collection = await findCollectionByIdForWorkspaceAny(id, workspace.id)
      if (!collection) throw new NotFoundError('Collection')
      // findCollectionByIdForWorkspaceAny matches active collections too — without this
      // check, purging by a stale/active id would permanently delete a live collection
      // instead of one actually sitting in the trash.
      if (!collection.deletedAt) throw new ValidationError('Collection is not in trash')
      await purgeCollection(id)
    } else {
      const request = await findDeletedRequestById(id)
      if (!request) throw new NotFoundError('Request')
      const col = await findCollectionByIdForWorkspaceAny(request.collectionId, workspace.id)
      if (!col) throw new ForbiddenError('Access denied')
      await purgeRequest(id)
    }

    return NextResponse.json({ success: true })
  })
}
