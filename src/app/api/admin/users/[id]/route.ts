import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth/session'
import { findUserById, findUserByEmail, updateUserFlags, deleteUser } from '@/db/queries/users'
import { logAdminAction } from '@/db/queries/admin_audit_logs'
import { adminUpdateUserSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: { id: string } }

/** PATCH /api/admin/users/[id] — toggle isAdmin/isActive (admin CMS only, cannot self-demote/self-disable) */
export function PATCH(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireAdmin()
    const body = await req.json()
    const parsed = adminUpdateUserSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const target = await findUserById(params.id)
    if (!target) throw new NotFoundError('User')

    if (params.id === session.user.id) {
      if (parsed.data.isAdmin === false) {
        throw new ForbiddenError('You cannot remove your own admin access')
      }
      if (parsed.data.isActive === false) {
        throw new ForbiddenError('You cannot disable your own account')
      }
    }

    const { name, email, password, isAdmin, isActive } = parsed.data
    const update: Parameters<typeof updateUserFlags>[1] = { isAdmin, isActive }
    if (name !== undefined) update.name = name
    if (email !== undefined) {
      const normalized = email.toLowerCase()
      if (normalized !== target.email) {
        const existing = await findUserByEmail(normalized)
        if (existing) throw new ConflictError('An account with this email already exists')
      }
      update.email = normalized
    }
    if (password !== undefined) update.passwordHash = await bcrypt.hash(password, 12)

    const updated = await updateUserFlags(params.id, update)

    const auditBase = {
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetUserId: target.id,
      targetUserEmail: target.email,
      targetUserName: target.name,
    }
    if (parsed.data.isAdmin !== undefined && parsed.data.isAdmin !== target.isAdmin) {
      await logAdminAction({ ...auditBase, action: parsed.data.isAdmin ? 'grant_admin' : 'revoke_admin' })
    }
    if (parsed.data.isActive !== undefined && parsed.data.isActive !== target.isActive) {
      await logAdminAction({ ...auditBase, action: parsed.data.isActive ? 'activate_user' : 'deactivate_user' })
    }
    const profileChanged =
      (name !== undefined && name !== target.name) ||
      (update.email !== undefined && update.email !== target.email) ||
      password !== undefined
    if (profileChanged) {
      await logAdminAction({ ...auditBase, action: 'update_user' })
    }

    return NextResponse.json(updated)
  })
}

/** DELETE /api/admin/users/[id] — hard delete (cascades owned workspaces), cannot self-delete */
export function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireAdmin()

    if (params.id === session.user.id) {
      throw new ForbiddenError('You cannot delete your own account')
    }

    const target = await findUserById(params.id)
    if (!target) throw new NotFoundError('User')

    await logAdminAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'delete_user',
      targetUserId: target.id,
      targetUserEmail: target.email,
      targetUserName: target.name,
    })
    await deleteUser(params.id)
    return NextResponse.json({ success: true })
  })
}
