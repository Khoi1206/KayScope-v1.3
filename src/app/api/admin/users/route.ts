import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/auth/session'
import { listUsersForAdmin, countUsersForAdmin, findUserByEmail, createUser } from '@/db/queries/users'
import { upsertPersonalWorkspace } from '@/db/queries/workspaces'
import { logAdminAction } from '@/db/queries/admin_audit_logs'
import { adminCreateUserSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ConflictError, ValidationError } from '@/lib/errors'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

/** GET /api/admin/users?search=&page=&pageSize= — paginated list + search users (admin CMS only). The requesting admin's own account is never included. */
export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireAdmin()
    const search = req.nextUrl.searchParams.get('search') ?? undefined
    const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('pageSize') ?? '', 10) || DEFAULT_PAGE_SIZE)
    )

    const [rows, total] = await Promise.all([
      listUsersForAdmin(search, page, pageSize, session.user.id),
      countUsersForAdmin(search, session.user.id),
    ])

    return NextResponse.json({ users: rows, total, page, pageSize })
  })
}

/** POST /api/admin/users — create a user account (admin CMS only) */
export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireAdmin()
    const body = await req.json()
    const parsed = adminCreateUserSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const { name, email, password, isAdmin, isActive } = parsed.data

    const existing = await findUserByEmail(email)
    if (existing) throw new ConflictError('An account with this email already exists')

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser({ name, email, passwordHash, provider: 'credentials', isAdmin, isActive })
    await upsertPersonalWorkspace(user.id, `${user.name}'s Workspace`)

    await logAdminAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'create_user',
      targetUserId: user.id,
      targetUserEmail: user.email,
      targetUserName: user.name,
    })

    return NextResponse.json(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        provider: user.provider,
        createdAt: user.createdAt,
      },
      { status: 201 }
    )
  })
}
