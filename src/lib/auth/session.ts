import { auth } from './auth'
import { ForbiddenError, UnauthorizedError } from '@/lib/errors'

/** Require a valid session. Throws UnauthorizedError if not authenticated. */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new UnauthorizedError('Authentication required')
  }
  return session as { user: { id: string; name: string | null; email: string } }
}

/** Require a valid session AND `isAdmin === true`. Throws ForbiddenError otherwise. */
export async function requireAdmin() {
  const session = await requireSession()
  const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin === true
  if (!isAdmin) {
    throw new ForbiddenError('Admin access required')
  }
  return session as { user: { id: string; name: string | null; email: string; isAdmin: true } }
}
