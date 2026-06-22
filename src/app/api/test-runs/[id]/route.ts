import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findTestRunByIdForWorkspace } from '@/db/queries/test_runs'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const run = await findTestRunByIdForWorkspace(id, workspace.id)
    if (!run) throw new NotFoundError('Test run')
    return NextResponse.json(run)
  })
}
