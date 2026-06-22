import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findTestSuitesByWorkspace, createTestSuite } from '@/db/queries/test_suites'
import { createTestSuiteSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const suites = await findTestSuitesByWorkspace(workspace.id)
    return NextResponse.json(suites)
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const body = await req.json()
    const parsed = createTestSuiteSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const collection = await findCollectionByIdForWorkspace(parsed.data.collectionId, workspace.id)
    if (!collection) throw new NotFoundError('Collection')
    const suite = await createTestSuite(workspace.id, {
      ...parsed.data,
      createdBy: session.user.id,
    })
    return NextResponse.json(suite, { status: 201 })
  })
}
