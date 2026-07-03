import { eq, and, or, isNull, gt } from 'drizzle-orm'
import { db, cookies } from '../index'

export async function findCookiesByWorkspace(workspaceId: string) {
  return db.select().from(cookies).where(eq(cookies.workspaceId, workspaceId))
}

/** Cookies applicable to a given hostname (exact match or parent-domain match) and not expired. */
export async function findCookiesForHost(workspaceId: string, hostname: string) {
  const all = await db
    .select()
    .from(cookies)
    .where(and(
      eq(cookies.workspaceId, workspaceId),
      or(isNull(cookies.expires), gt(cookies.expires, new Date())),
    ))
  return all.filter(c => hostname === c.domain || hostname.endsWith(`.${c.domain}`))
}

export async function upsertCookie(
  workspaceId: string,
  data: {
    domain: string
    name: string
    value: string
    path?: string
    expires?: Date | null
    httpOnly?: boolean
    secure?: boolean
    sameSite?: string | null
  }
) {
  const path = data.path ?? '/'
  const existing = await db
    .select()
    .from(cookies)
    .where(and(
      eq(cookies.workspaceId, workspaceId),
      eq(cookies.domain, data.domain),
      eq(cookies.path, path),
      eq(cookies.name, data.name),
    ))
    .limit(1)

  if (existing[0]) {
    const rows = await db
      .update(cookies)
      .set({
        value: data.value,
        expires: data.expires ?? null,
        httpOnly: data.httpOnly ?? false,
        secure: data.secure ?? false,
        sameSite: data.sameSite ?? null,
        updatedAt: new Date(),
      })
      .where(eq(cookies.id, existing[0].id))
      .returning()
    return rows[0]!
  }

  const rows = await db
    .insert(cookies)
    .values({
      workspaceId,
      domain: data.domain,
      name: data.name,
      value: data.value,
      path,
      expires: data.expires ?? null,
      httpOnly: data.httpOnly ?? false,
      secure: data.secure ?? false,
      sameSite: data.sameSite ?? null,
    })
    .returning()
  return rows[0]!
}

export async function deleteCookie(id: string, workspaceId: string) {
  await db.delete(cookies).where(and(eq(cookies.id, id), eq(cookies.workspaceId, workspaceId)))
}

export async function deleteCookiesByDomain(workspaceId: string, domain: string) {
  await db.delete(cookies).where(and(eq(cookies.workspaceId, workspaceId), eq(cookies.domain, domain)))
}
