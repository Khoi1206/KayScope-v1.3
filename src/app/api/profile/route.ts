import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireSession } from '@/lib/auth/session'
import { findUserById, updateUserProfile } from '@/db/queries/users'
import { updateProfileSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

/** GET /api/profile — current user's profile */
export function GET() {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const user = await findUserById(session.user.id)
    if (!user) throw new NotFoundError('User')
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin })
  })
}

/** PATCH /api/profile — change own name and/or password (current password required for password change) */
export function PATCH(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const body = await req.json()
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const user = await findUserById(session.user.id)
    if (!user) throw new NotFoundError('User')

    const update: Partial<{ name: string; passwordHash: string }> = {}
    if (parsed.data.name !== undefined) update.name = parsed.data.name

    if (parsed.data.newPassword !== undefined) {
      if (!user.passwordHash) throw new ValidationError('This account has no password set')
      const valid = await bcrypt.compare(parsed.data.currentPassword!, user.passwordHash)
      if (!valid) throw new ValidationError('Current password is incorrect')
      update.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    }

    const updated = await updateUserProfile(session.user.id, update)
    return NextResponse.json(updated)
  })
}
