import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findEnvironmentByIdForWorkspace, updateEnvironment, deleteEnvironment } from '@/db/queries/environments'
import { logActivity } from '@/db/queries/activity_logs'
import { updateEnvironmentSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { maskVariables, encryptVariables } from '@/lib/execute/variable-crypto'

type Params = { params: { id: string } }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const env = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!env) throw new NotFoundError('Environment not found')
    return NextResponse.json({ ...env, variables: maskVariables(env.variables) })
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const env = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!env) throw new NotFoundError('Environment not found')
    const body = await req.json()
    const parsed = updateEnvironmentSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const updateData: Parameters<typeof updateEnvironment>[1] = {}
    if (parsed.data.name) updateData.name = parsed.data.name
    if (parsed.data.variables) {
      updateData.variables = encryptVariables(parsed.data.variables, env.variables)
    }

    const updated = await updateEnvironment(params.id, updateData)
    if (!updated) throw new NotFoundError('Environment not found')
    if (parsed.data.name && parsed.data.name !== env.name) {
      await logActivity({
        workspaceId: workspace.id,
        actorId: session.user.id,
        action: 'renamed',
        entityType: 'environment',
        entityId: updated.id,
        entityName: updated.name,
        metadata: { previousName: env.name },
      })
    }
    return NextResponse.json({ ...updated, variables: maskVariables(updated.variables) })
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const env = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!env) throw new NotFoundError('Environment not found')
    await deleteEnvironment(params.id)
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'deleted',
      entityType: 'environment',
      entityId: env.id,
      entityName: env.name,
    })
    return NextResponse.json({ success: true })
  })
}
