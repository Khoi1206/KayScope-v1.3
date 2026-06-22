import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import {
  findAllWorkspacesByOwner,
  createWorkspace,
} from '@/db/queries/workspaces'
import { createWorkspaceSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'

/** GET /api/workspaces — list all workspaces owned by the current user */
export function GET() {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspaces = await findAllWorkspacesByOwner(session.user.id)
    return NextResponse.json(workspaces)
  })
}

/** POST /api/workspaces — create a new workspace */
export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const parsed = createWorkspaceSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const ws = await createWorkspace(session.user.id, parsed.data.name, {
      type: parsed.data.type,
      description: parsed.data.description,
    })

    return NextResponse.json(
      { id: ws.id, name: ws.name, type: ws.type, description: ws.description, createdAt: ws.createdAt },
      { status: 201 }
    )
  })
}
