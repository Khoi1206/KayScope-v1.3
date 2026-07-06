import bcrypt from 'bcryptjs'
import { findUserByEmail, createUser } from '@/db/queries/users'
import { upsertPersonalWorkspace } from '@/db/queries/workspaces'
import logger from '@/lib/logger'

/**
 * Idempotent bootstrap admin account, run once on server startup (src/instrumentation.ts).
 * Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from env; skips silently when the
 * account already exists, and skips with a warning when the env vars are not set.
 */
export async function seedAdminUser() {
  const email = "admin@example.com"
  const password = "12345678"
  const name = "Administrator"

  if (!email || !password) {
    logger.warn('[seed-admin] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping bootstrap admin')
    return
  }
  if (password.length < 8) {
    logger.error('[seed-admin] ADMIN_PASSWORD must be at least 8 characters — skipping bootstrap admin')
    return
  }

  try {
    const existing = await findUserByEmail(email)
    if (existing) {
      logger.info({ email }, '[seed-admin] admin account already exists — nothing to do')
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser({
      name,
      email,
      passwordHash,
      provider: 'credentials',
      isAdmin: true,
      isActive: true,
    })
    await upsertPersonalWorkspace(user.id, `${user.name}'s Workspace`)
    logger.info({ email, userId: user.id }, '[seed-admin] bootstrap admin account created')
  } catch (err) {
    // Never crash startup over seeding — log and continue
    logger.error(err, '[seed-admin] failed to seed bootstrap admin')
  }
}
