import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner, updateWorkspace } from '@/db/queries/workspaces'
import { updateWorkspaceSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { encryptValue, isEncrypted, maskValue } from '@/lib/crypto'
import type { Variable } from '@/db/schema'

function maskVariables(variables: Variable[]): Variable[] {
  return variables.map(v => v.secret ? { ...v, value: maskValue() } : v)
}

function encryptVariables(incoming: Variable[], existing: Variable[]): Variable[] {
  return incoming.map(v => {
    if (!v.secret) return v
    const existingVar = existing.find(e => e.key === v.key)
    if (existingVar?.secret && v.value === maskValue()) return { ...v, value: existingVar.value }
    if (isEncrypted(v.value)) return v
    return { ...v, value: encryptValue(v.value) }
  })
}

export function GET() {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    return NextResponse.json({
      ...workspace,
      globalVariables: maskVariables(workspace.globalVariables),
    })
  })
}

export function PUT(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await findWorkspaceByOwner(session.user.id)
    if (!workspace) throw new NotFoundError('Workspace not found')
    const body = await req.json()
    const parsed = updateWorkspaceSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const updateData: Parameters<typeof updateWorkspace>[1] = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.activeEnvironmentId !== undefined) updateData.activeEnvironmentId = parsed.data.activeEnvironmentId
    if (parsed.data.globalVariables) {
      updateData.globalVariables = encryptVariables(parsed.data.globalVariables, workspace.globalVariables)
    }

    const updated = await updateWorkspace(workspace.id, updateData)
    if (!updated) throw new NotFoundError('Workspace not found')
    return NextResponse.json({
      ...updated,
      globalVariables: maskVariables(updated.globalVariables),
    })
  })
}
