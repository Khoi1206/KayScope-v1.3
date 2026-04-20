import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import {
  findEnvironmentsByWorkspace,
  createEnvironment,
} from '@/db/queries/environments'
import { createEnvironmentSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { encryptValue, maskValue } from '@/lib/crypto'
import type { Variable } from '@/db/schema'

function maskVariables(variables: Variable[]): Variable[] {
  return variables.map(v => v.secret ? { ...v, value: maskValue() } : v)
}

function encryptVariables(variables: Variable[]): Variable[] {
  return variables.map(v => v.secret ? { ...v, value: encryptValue(v.value) } : v)
}

export function GET() {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
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
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const body = await req.json()
    const parsed = createEnvironmentSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    const env = await createEnvironment(workspace.id, {
      name: parsed.data.name,
      variables: encryptVariables(parsed.data.variables),
      createdBy: session.user.id,
    })
    return NextResponse.json({
      ...env,
      variables: maskVariables(env.variables),
    }, { status: 201 })
  })
}
