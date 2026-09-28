import { eq } from 'drizzle-orm'
import { db, emailSettings } from '../index'
import type { EmailSettings } from '../schema'

/** Returns the single global email-settings row, creating a blank default one if none exists yet. */
export async function getEmailSettings(): Promise<EmailSettings> {
  const rows = await db.select().from(emailSettings).limit(1)
  if (rows[0]) return rows[0]

  const created = await db.insert(emailSettings).values({}).returning()
  return created[0]!
}

export async function upsertEmailSettings(
  data: Partial<{
    host: string
    port: number
    secure: boolean
    username: string
    password: string
    fromAddress: string
    fromName: string
  }>,
  updatedBy: string
): Promise<EmailSettings> {
  const existing = await getEmailSettings()
  const rows = await db
    .update(emailSettings)
    .set({ ...data, updatedBy, updatedAt: new Date() })
    .where(eq(emailSettings.id, existing.id))
    .returning()
  return rows[0] ?? existing
}
