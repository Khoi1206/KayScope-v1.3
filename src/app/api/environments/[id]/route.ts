import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import {
  findEnvironmentByIdForWorkspace,
  updateEnvironment,
  deleteEnvironment,
} from '@/db/queries/environments'
import { updateEnvironmentSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { maskVariables, encryptVariables } from '@/lib/execute/variable-crypto'

type Params = { params: { id: string } }

export function GET(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const env = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!env) throw new NotFoundError('Environment not found')
    return NextResponse.json({ ...env, variables: maskVariables(env.variables) })
  })
}

export function PUT(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const env = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!env) throw new NotFoundError('Environment not found')
    const body = await req.json()
    const parsed = updateEnvironmentSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    let updateData: Parameters<typeof updateEnvironment>[1] = {}
    if (parsed.data.name) updateData.name = parsed.data.name
    if (parsed.data.variables) {
      updateData.variables = encryptVariables(parsed.data.variables, env.variables)
    }

    const updated = await updateEnvironment(params.id, updateData)
    if (!updated) throw new NotFoundError('Environment not found')
    return NextResponse.json({ ...updated, variables: maskVariables(updated.variables) })
  })
}

export function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const env = await findEnvironmentByIdForWorkspace(params.id, workspace.id)
    if (!env) throw new NotFoundError('Environment not found')
    await deleteEnvironment(params.id)
    return NextResponse.json({ success: true })
  })
}
