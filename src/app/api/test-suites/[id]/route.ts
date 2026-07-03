import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import {
  findTestSuiteByIdForWorkspace,
  updateTestSuite,
  deleteTestSuite,
} from '@/db/queries/test_suites'
import { updateTestSuiteSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const suite = await findTestSuiteByIdForWorkspace(id, workspace.id)
    if (!suite) throw new NotFoundError('Test suite')
    return NextResponse.json(suite)
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const suite = await findTestSuiteByIdForWorkspace(id, workspace.id)
    if (!suite) throw new NotFoundError('Test suite')
    const body = await req.json()
    const parsed = updateTestSuiteSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const updated = await updateTestSuite(id, parsed.data)
    return NextResponse.json(updated)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const suite = await findTestSuiteByIdForWorkspace(id, workspace.id)
    if (!suite) throw new NotFoundError('Test suite')
    await deleteTestSuite(id)
    return NextResponse.json({ success: true })
  })
}
