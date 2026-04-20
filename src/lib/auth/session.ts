import { auth } from './auth'
import { UnauthorizedError } from '@/lib/errors'

/** Require a valid session. Throws UnauthorizedError if not authenticated. */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new UnauthorizedError('Authentication required')
  }
  return session as { user: { id: string; name: string | null; email: string } }
}
