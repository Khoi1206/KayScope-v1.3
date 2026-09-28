import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findRequestById } from '@/db/queries/requests'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { createRequestVersion, findRequestVersionsByRequest } from '@/db/queries/request_versions'
import { createRequestVersionSchema, requestVersionsQuerySchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const request = await findRequestById(id)
    if (!request) throw new NotFoundError('Request')
    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')

    const parsedQuery = requestVersionsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    const limit = parsedQuery.success ? parsedQuery.data.limit : 20

    const versions = await findRequestVersionsByRequest(id, limit)
    return NextResponse.json(versions)
  })
}

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const request = await findRequestById(id)
    if (!request) throw new NotFoundError('Request')
    const col = await findCollectionByIdForWorkspace(request.collectionId, workspace.id)
    if (!col) throw new ForbiddenError('Access denied')

    const body = await req.json()
    const parsed = createRequestVersionSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    // The client sends its current in-editor snapshot rather than us re-reading
    // `requests` — the debounced autosave may not have flushed yet, so reading
    // from the client avoids snapshotting stale content.
    const version = await createRequestVersion({
      workspaceId: workspace.id,
      requestId: id,
      label: parsed.data.label,
      method: parsed.data.method,
      url: parsed.data.url,
      params: parsed.data.params,
      headers: parsed.data.headers,
      body: parsed.data.body,
      auth: parsed.data.auth,
      preRequestScript: parsed.data.preRequestScript,
      postRequestScript: parsed.data.postRequestScript,
      createdBy: session.user.id,
    })
    return NextResponse.json(version)
  })
}
