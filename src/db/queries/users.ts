import { eq } from 'drizzle-orm'
import { db, users } from '../index'
import type { NewUser } from '../schema/users'

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
