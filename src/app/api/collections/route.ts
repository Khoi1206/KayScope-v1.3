import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findCollectionsByWorkspace, createCollection } from '@/db/queries/collections'
import { createCollectionSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { maskValue } from '@/lib/crypto'
import type { Variable } from '@/db/schema'

function maskVariables(variables: Variable[]): Variable[] {
  return variables.map(v => v.secret ? { ...v, value: maskValue() } : v)
}

export function GET() {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const cols = await findCollectionsByWorkspace(workspace.id)
    return NextResponse.json(cols.map(c => ({ ...c, variables: maskVariables(c.variables) })))
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const body = await req.json()
    const parsed = createCollectionSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const col = await createCollection(workspace.id, { ...parsed.data, createdBy: session.user.id })
    return NextResponse.json(col, { status: 201 })
  })
}
