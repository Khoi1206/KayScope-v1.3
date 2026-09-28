import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findFoldersByCollection, createFolder, reorderFolders } from '@/db/queries/folders'
import { logActivity } from '@/db/queries/activity_logs'
import { createFolderSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const collectionId = req.nextUrl.searchParams.get('collectionId')
    if (!collectionId) throw new ValidationError('collectionId query param required')
    const col = await findCollectionByIdForWorkspace(collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection')
    const items = await findFoldersByCollection(collectionId)
    return NextResponse.json(items)
  })
}

export function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const body = await req.json() as { collectionId: string; items: { id: string; sortOrder: number }[] }
    if (!body?.collectionId || !Array.isArray(body?.items)) throw new ValidationError('collectionId and items required')
    const col = await findCollectionByIdForWorkspace(body.collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection')
    const existing = await findFoldersByCollection(body.collectionId)
    const ownedIds = new Set(existing.map(f => f.id))
    const safe = body.items.filter(i => ownedIds.has(i.id))
    await reorderFolders(safe)
    return NextResponse.json({ ok: true })
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const body = await req.json()
    const parsed = createFolderSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const col = await findCollectionByIdForWorkspace(parsed.data.collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection')
    const folder = await createFolder(parsed.data)
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'created',
      entityType: 'folder',
      entityId: folder.id,
      entityName: folder.name,
    })
    return NextResponse.json(folder, { status: 201 })
  })
}
