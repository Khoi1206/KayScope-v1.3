import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findRequestsByCollection, createRequest, reorderRequests } from '@/db/queries/requests'
import { createRequestSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const collectionId = req.nextUrl.searchParams.get('collectionId')
    if (!collectionId) throw new ValidationError('collectionId query param required')
    const col = await findCollectionByIdForWorkspace(collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    const items = await findRequestsByCollection(collectionId)
    return NextResponse.json(items)
  })
}

export function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const body = await req.json() as { collectionId: string; items: { id: string; sortOrder: number }[] }
    if (!body?.collectionId || !Array.isArray(body?.items)) throw new ValidationError('collectionId and items required')
    const col = await findCollectionByIdForWorkspace(body.collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    const existing = await findRequestsByCollection(body.collectionId)
    const ownedIds = new Set(existing.map(r => r.id))
    const safe = body.items.filter(i => ownedIds.has(i.id))
    await reorderRequests(safe)
    return NextResponse.json({ ok: true })
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const body = await req.json()
    const parsed = createRequestSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const col = await findCollectionByIdForWorkspace(parsed.data.collectionId, workspace.id)
    if (!col) throw new NotFoundError('Collection not found')
    const request = await createRequest({ ...parsed.data, createdBy: session.user.id })
    return NextResponse.json(request, { status: 201 })
  })
}
