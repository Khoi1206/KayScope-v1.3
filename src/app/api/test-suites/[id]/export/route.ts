import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findTestSuiteByIdForWorkspace } from '@/db/queries/test_suites'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findRequestsByCollection } from '@/db/queries/requests'
import { findEnvironmentByIdForWorkspace } from '@/db/queries/environments'
import { generatePlaywrightTest } from '@/lib/codegen/playwright'
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

    const collection = await findCollectionByIdForWorkspace(suite.collectionId, workspace.id)
    if (!collection) throw new NotFoundError('Collection')

    const requests = await findRequestsByCollection(suite.collectionId)

    let environmentName: string | undefined
    if (suite.environmentId) {
      const env = await findEnvironmentByIdForWorkspace(suite.environmentId, workspace.id)
      environmentName = env?.name
    }

    const code = generatePlaywrightTest({ suite, collection, requests, environmentName })
    const safeName = suite.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()

    return new NextResponse(code, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.test.ts"`,
      },
    })
  })
}
