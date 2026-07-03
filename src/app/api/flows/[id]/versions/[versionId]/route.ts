import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findFlowVersionByIdForWorkspace, deleteFlowVersion } from '@/db/queries/flow_versions'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'

type Params = { params: Promise<{ id: string; versionId: string }> }

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id, versionId } = await params
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')

    const version = await findFlowVersionByIdForWorkspace(versionId, workspace.id)
    if (!version || version.flowId !== id) throw new NotFoundError('Flow version')

    await deleteFlowVersion(versionId)
    return NextResponse.json({ success: true })
  })
}
