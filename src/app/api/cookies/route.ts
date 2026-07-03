import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace, requireWorkspaceRole } from '@/lib/auth/workspace-guard'
import { findCookiesByWorkspace, upsertCookie, deleteCookie, deleteCookiesByDomain } from '@/db/queries/cookies'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'
import { encryptValue, maskValue } from '@/lib/crypto'

function maskCookie<T extends { value: string }>(c: T) {
  return { ...c, value: maskValue() }
}

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const domain = req.nextUrl.searchParams.get('domain')
    const all = await findCookiesByWorkspace(workspace.id)
    const filtered = domain ? all.filter(c => c.domain === domain) : all
    return NextResponse.json(filtered.map(maskCookie))
  })
}

const createCookieSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1),
  value: z.string(),
  path: z.string().optional(),
  expires: z.string().datetime().nullish(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.string().nullish(),
})

export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const parsed = createCookieSchema.safeParse(await req.json())
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid input')
    const data = parsed.data
    const cookie = await upsertCookie(workspace.id, {
      domain: data.domain,
      name: data.name,
      value: encryptValue(data.value),
      path: data.path,
      expires: data.expires ? new Date(data.expires) : null,
      httpOnly: data.httpOnly,
      secure: data.secure,
      sameSite: data.sameSite,
    })
    return NextResponse.json(maskCookie(cookie), { status: 201 })
  })
}

export function DELETE(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireWorkspaceRole(req, session.user.id, 'editor')
    const id = req.nextUrl.searchParams.get('id')
    const domain = req.nextUrl.searchParams.get('domain')
    if (id) {
      await deleteCookie(id, workspace.id)
    } else if (domain) {
      await deleteCookiesByDomain(workspace.id, domain)
    } else {
      throw new ValidationError('id or domain query param required')
    }
    return NextResponse.json({ ok: true })
  })
}
