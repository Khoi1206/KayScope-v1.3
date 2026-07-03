import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth/auth'
import { SsrfGuard } from '@/lib/execute/ssrf-guard'

const bodySchema = z.object({
  grantType: z.enum(['client_credentials', 'password', 'authorization_code']),
  tokenUrl: z.string().url('Invalid token URL'),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  clientAuth: z.enum(['body', 'basic_header']).optional(),
  scope: z.string().optional(),
  // Password grant
  username: z.string().optional(),
  password: z.string().optional(),
  // Authorization Code grant
  code: z.string().optional(),
  redirectUri: z.string().optional(),
})

const ssrfGuard = new SsrfGuard()

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })

  const { grantType, tokenUrl, clientId, clientSecret, clientAuth, scope, username, password, code, redirectUri } = parsed.data

  try {
    await ssrfGuard.assertSafe(tokenUrl)
  } catch {
    return NextResponse.json({ error: 'Token URL is not allowed (SSRF protection)' }, { status: 400 })
  }

  const useBasicHeader = clientAuth === 'basic_header'
  const body = new URLSearchParams()
  body.set('grant_type', grantType)
  if (!useBasicHeader) {
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
  }
  if (scope) body.set('scope', scope)

  if (grantType === 'password') {
    if (!username || !password) return NextResponse.json({ error: 'Username and password required for password grant' }, { status: 400 })
    body.set('username', username)
    body.set('password', password)
  }

  if (grantType === 'authorization_code') {
    if (!code || !redirectUri) return NextResponse.json({ error: 'Code and redirectUri required for authorization_code grant' }, { status: 400 })
    body.set('code', code)
    body.set('redirect_uri', redirectUri)
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  if (useBasicHeader) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  try {
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    })

    const responseText = await resp.text()
    let data: Record<string, unknown>
    try {
      data = JSON.parse(responseText)
    } catch {
      return NextResponse.json({ error: `Token endpoint returned non-JSON: ${responseText.slice(0, 200)}` }, { status: 502 })
    }

    if (!resp.ok) {
      const errMsg = (data.error_description as string) ?? (data.error as string) ?? `HTTP ${resp.status}`
      return NextResponse.json({ error: errMsg }, { status: resp.status })
    }

    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      scope: data.scope,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to reach token endpoint' }, { status: 502 })
  }
}
