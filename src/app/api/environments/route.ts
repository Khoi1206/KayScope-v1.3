import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findEnvironmentsByWorkspace, createEnvironment } from '@/db/queries/environments'
import { logActivity } from '@/db/queries/activity_logs'
import { createEnvironmentSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'
import { maskVariables, encryptVariables } from '@/lib/execute/variable-crypto'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const envs = await findEnvironmentsByWorkspace(workspace.id)
    return NextResponse.json(envs.map(env => ({
      ...env,
      variables: maskVariables(env.variables),
    })))
  })
}

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const body = await req.json()
    const parsed = createEnvironmentSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const env = await createEnvironment(workspace.id, {
      name: parsed.data.name,
      variables: encryptVariables(parsed.data.variables, []),
      createdBy: session.user.id,
    })
    await logActivity({
      workspaceId: workspace.id,
      actorId: session.user.id,
      action: 'created',
      entityType: 'environment',
      entityId: env.id,
      entityName: env.name,
    })
    return NextResponse.json({
      ...env,
      variables: maskVariables(env.variables),
    }, { status: 201 })
  })
}
