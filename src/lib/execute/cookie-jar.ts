import { encryptValue, decryptValue } from '@/lib/crypto'
import { findCookiesForHost, upsertCookie } from '@/db/queries/cookies'

export interface ParsedCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: Date | null
  httpOnly: boolean
  secure: boolean
  sameSite: string | null
}

export function parseSetCookie(raw: string, requestHostname: string): ParsedCookie | null {
  const parts = raw.split(';').map(p => p.trim()).filter(Boolean)
  const first = parts.shift()
  if (!first) return null
  const eqIdx = first.indexOf('=')
  if (eqIdx === -1) return null
  const name = first.slice(0, eqIdx).trim()
  const value = first.slice(eqIdx + 1).trim()
  if (!name) return null

  let domain = requestHostname
  let path = '/'
  let expires: Date | null = null
  let httpOnly = false
  let secure = false
  let sameSite: string | null = null

  for (const part of parts) {
    const eq = part.indexOf('=')
    const k = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase()
    const v = eq === -1 ? '' : part.slice(eq + 1).trim()
    switch (k) {
      case 'domain':
        domain = v.replace(/^\./, '') || requestHostname
        break
      case 'path':
        path = v || '/'
        break
      case 'expires': {
        const d = new Date(v)
        if (!Number.isNaN(d.getTime())) expires = d
        break
      }
      case 'max-age': {
        const seconds = Number(v)
        if (!Number.isNaN(seconds)) expires = new Date(Date.now() + seconds * 1000)
        break
      }
      case 'httponly':
        httpOnly = true
        break
      case 'secure':
        secure = true
        break
      case 'samesite':
        sameSite = v || null
        break
    }
  }

  return { name, value, domain, path, expires, httpOnly, secure, sameSite }
}

/** Parse and persist Set-Cookie headers from a response into the workspace cookie jar. */
export async function persistSetCookies(workspaceId: string, setCookies: string[], requestHostname: string): Promise<void> {
  for (const raw of setCookies) {
    const parsed = parseSetCookie(raw, requestHostname)
    if (!parsed) continue
    await upsertCookie(workspaceId, {
      domain: parsed.domain,
      name: parsed.name,
      value: encryptValue(parsed.value),
      path: parsed.path,
      expires: parsed.expires,
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: parsed.sameSite,
    })
  }
}

/** Build a `Cookie:` header value from jar cookies applicable to the given host + path. */
export async function buildCookieHeader(workspaceId: string, hostname: string, path: string): Promise<string> {
  const rows = await findCookiesForHost(workspaceId, hostname)
  const applicable = rows.filter(c => c.path === '/' || path.startsWith(c.path))
  if (applicable.length === 0) return ''
  return applicable.map(c => `${c.name}=${decryptValue(c.value)}`).join('; ')
}
