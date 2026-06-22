import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findCollectionsByWorkspace, createCollection, reorderCollections } from '@/db/queries/collections'
import { createCollectionSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'
import { maskValue } from '@/lib/crypto'
import type { Variable } from '@/db/schema'

function maskVariables(variables: Variable[]): Variable[] {
  return variables.map(v => v.secret ? { ...v, value: maskValue() } : v)
}

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const cols = await findCollectionsByWorkspace(workspace.id)
    return NextResponse.json(cols.map(c => ({ ...c, variables: maskVariables(c.variables) })))
  })
}

export function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const body = await req.json() as { items: { id: string; sortOrder: number }[] }
    if (!Array.isArray(body?.items)) throw new ValidationError('items array required')
    const existing = await findCollectionsByWorkspace(workspace.id)
    const ownedIds = new Set(existing.map(c => c.id))
    const safe = body.items.filter(i => ownedIds.has(i.id))
    await reorderCollections(safe)
    return NextResponse.json({ ok: true })
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const body = await req.json()
    const parsed = createCollectionSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const col = await createCollection(workspace.id, { ...parsed.data, createdBy: session.user.id })
    return NextResponse.json(col, { status: 201 })
  })
}
