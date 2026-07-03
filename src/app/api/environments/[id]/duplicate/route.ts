import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findEnvironmentByIdForWorkspace, createEnvironment } from '@/db/queries/environments'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError } from '@/lib/errors'
import { maskVariables } from '@/lib/execute/variable-crypto'

type Params = { params: { id: string } }

export function POST(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const source = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!source) throw new NotFoundError('Environment not found')

    // Variable values are already AES-256-GCM encrypted strings — copy verbatim, no re-encryption needed.
    const copy = await createEnvironment(workspace.id, {
      name: `${source.name} (copy)`,
      variables: source.variables,
      createdBy: session.user.id,
    })
    return NextResponse.json({ ...copy, variables: maskVariables(copy.variables) }, { status: 201 })
  })
}
