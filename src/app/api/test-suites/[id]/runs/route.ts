import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findTestSuiteByIdForWorkspace } from '@/db/queries/test_suites'
import { findTestRunsByTestSuite } from '@/db/queries/test_runs'
import { testRunsQuerySchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const suite = await findTestSuiteByIdForWorkspace(id, workspace.id)
    if (!suite) throw new NotFoundError('Test suite')
    const query = testRunsQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams)
    )
    const runs = await findTestRunsByTestSuite(id, query.limit)
    return NextResponse.json(runs)
  })
}
