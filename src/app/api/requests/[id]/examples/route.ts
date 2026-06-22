import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findRequestById } from '@/db/queries/requests'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { getExamplesByRequestId, createExample } from '@/db/queries/examples'
import type { NewExample } from '@/db/schema/examples'
import { createExampleSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors'

type Params = { params: { id: string } }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)

    const request = await findRequestById(params.id)
    if (!request) throw new NotFoundError('Request not found')

    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')

    const items = await getExamplesByRequestId(params.id, session.user.id)
    return NextResponse.json(items)
  })
}

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)

    const request = await findRequestById(params.id)
    if (!request) throw new NotFoundError('Request not found')

    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')

    const body = await req.json()
    const parsed = createExampleSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const d = parsed.data
    const example = await createExample({
      requestId: params.id,
      workspaceId: workspace.id,
      name: d.name,
      status: d.status,
      statusText: d.statusText,
      responseHeaders: d.responseHeaders,
      responseBody: d.responseBody,
      durationMs: d.durationMs,
      size: d.size,
      requestMethod: d.requestMethod,
      requestUrl: d.requestUrl,
      requestParams: d.requestParams as NewExample['requestParams'],
      requestHeaders: d.requestHeaders as NewExample['requestHeaders'],
      requestBody: d.requestBody as NewExample['requestBody'],
      requestAuth: d.requestAuth as NewExample['requestAuth'],
      createdBy: session.user.id,
    })

    return NextResponse.json(example, { status: 201 })
  })
}
