import { eq, ne, and, or, ilike, gte, desc, count } from 'drizzle-orm'
import { db, users } from '../index'
import type { NewUser } from '../schema/users'
import { ConflictError } from '@/lib/errors'

export async function findUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  return rows[0] ?? null
}

export async function findUserById(id: string) {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createUser(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>) {
  const rows = await db
    .insert(users)
    .values({ ...data, email: data.email.toLowerCase() })
    .returning()
  return rows[0]!
}

// ── Admin CMS ─────────────────────────────────────────────────────────────────

const adminListColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  isAdmin: users.isAdmin,
  isActive: users.isActive,
  provider: users.provider,
  createdAt: users.createdAt,
}

function adminListCondition(search: string | undefined, excludeId: string) {
  const conditions = [ne(users.id, excludeId)]
  if (search?.trim()) {
    const term = `%${search.trim()}%`
    conditions.push(or(ilike(users.name, term), ilike(users.email, term))!)
  }
  return and(...conditions)
}

/** List users (paginated), optionally filtered by a case-insensitive name/email search — for the admin CMS. The requesting admin's own account is always excluded. */
export async function listUsersForAdmin(search: string | undefined, page: number, pageSize: number, excludeId: string) {
  return db
    .select(adminListColumns)
    .from(users)
    .where(adminListCondition(search, excludeId))
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
}

/** Count users matching the same filter as listUsersForAdmin — for pagination. */
export async function countUsersForAdmin(search: string | undefined, excludeId: string) {
  const rows = await db.select({ count: count() }).from(users).where(adminListCondition(search, excludeId))
  return rows[0]?.count ?? 0
}

/** Aggregate user counts for the admin dashboard. */
export async function getAdminUserStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [total, active, admins, newLast7Days] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(users).where(eq(users.isActive, true)),
    db.select({ count: count() }).from(users).where(eq(users.isAdmin, true)),
    db.select({ count: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo)),
  ])
  return {
    total: total[0]?.count ?? 0,
    active: active[0]?.count ?? 0,
    admins: admins[0]?.count ?? 0,
    newLast7Days: newLast7Days[0]?.count ?? 0,
  }
}

/** Update a user's own profile (name and/or password). */
export async function updateUserProfile(id: string, data: Partial<{ name: string; passwordHash: string }>) {
  const rows = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email })
  return rows[0] ?? null
}

/** Update a user's isAdmin/isActive flags and/or profile fields — caller must guard against self-demotion/self-disable. */
export async function updateUserFlags(
  id: string,
  data: Partial<{ isAdmin: boolean; isActive: boolean; name: string; email: string; passwordHash: string }>
) {
  const rows = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning(adminListColumns)
  return rows[0] ?? null
}

/** Hard-delete a user — cascades to owned workspaces and everything they authored, via FK. Caller must guard against self-delete. */
export async function deleteUser(id: string) {
  try {
    await db.delete(users).where(eq(users.id, id))
  } catch (err) {
    // Every FK to users.id cascades today; a 23503 here means a newly added
    // reference was created without onDelete: 'cascade'. Surface that as a clean
    // 409 instead of an unhandled 500.
    if ((err as { code?: string } | null)?.code === '23503') {
      throw new ConflictError('Cannot delete this user — other records still reference them.')
    }
    throw err
  }
}
