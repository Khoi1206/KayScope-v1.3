import { NextResponse } from 'next/server'

// Self-registration is disabled — accounts are created by an admin in the CMS
// via POST /api/admin/users. Original handler kept below for reference.
export async function POST() {
  return NextResponse.json({ error: 'Registration is disabled' }, { status: 404 })
}

/*
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { registerSchema } from '@/schemas'
import { findUserByEmail, createUser } from '@/db/queries/users'
import { upsertPersonalWorkspace } from '@/db/queries/workspaces'
import { ConflictError, ValidationError } from '@/lib/errors'
import logger from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')
    }

    const { name, email, password } = parsed.data

    const existing = await findUserByEmail(email)
    if (existing) {
      throw new ConflictError('An account with this email already exists')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser({ name, email, passwordHash, provider: 'credentials' })
    await upsertPersonalWorkspace(user.id, `${user.name}'s Workspace`)

    logger.info({ userId: user.id }, 'New user registered')
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof ConflictError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    logger.error(err, 'Registration error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
*/
