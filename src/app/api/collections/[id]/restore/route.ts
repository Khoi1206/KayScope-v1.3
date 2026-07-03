import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspaceAny, restoreCollection } from '@/db/queries/collections'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: { id: string } }

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const collection = await findCollectionByIdForWorkspaceAny(params.id, workspace.id)
    if (!collection) throw new NotFoundError('Collection not found')
    await restoreCollection(params.id)
    return NextResponse.json({ success: true })
  })
}
