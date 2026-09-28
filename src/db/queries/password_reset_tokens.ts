import { eq, and, isNull, gt } from 'drizzle-orm'
import { db, passwordResetTokens } from '../index'

/** Invalidates any existing unconsumed codes for the user, then stores a fresh one. */
export async function createResetToken(userId: string, codeHash: string, expiresAt: Date) {
  await db.delete(passwordResetTokens).where(
    and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.consumedAt))
  )
  const rows = await db.insert(passwordResetTokens).values({ userId, codeHash, expiresAt }).returning()
  return rows[0]!
}

/** Returns the token row if it matches, is unconsumed, and hasn't expired. */
export async function findValidToken(userId: string, codeHash: string) {
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.codeHash, codeHash),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export async function consumeToken(id: string) {
  await db.update(passwordResetTokens).set({ consumedAt: new Date() }).where(eq(passwordResetTokens.id, id))
}
