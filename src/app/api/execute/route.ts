import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { executeSchema } from '@/schemas'
import { execute } from '@/lib/execute/executor'
import { ValidationError, UnauthorizedError } from '@/lib/errors'
import logger from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession()

    // Validate workspace ownership via X-Workspace-Id header (IDOR-safe)
    const workspace = await requireActiveWorkspace(req, session.user.id)

    const body = await req.json()
    // Use the validated workspace ID — not the client-supplied one
    const parsed = executeSchema.safeParse({ ...body, workspaceId: workspace.id })
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid request')
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? '127.0.0.1'

    const result = await execute(parsed.data, session.user.id, ip)

    if (result.rateLimited) {
      return NextResponse.json({ error: result.error }, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    logger.error(err, 'Execute route error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
