import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Keep locale constants here — do NOT import @/i18n/routing in middleware.
// That module calls createNavigation() at module scope which is not Edge-compatible
// and causes Next.js to silently drop the middleware (empty middleware manifest).
const DEFAULT_LOCALE = 'en'
const LOCALE_PATTERN = /^\/(en|vi)(\/|$)/

const authRoutes = ['/login', '/register', '/forgot-password']
const publicApiRoutes = ['/api/auth']

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  // Self-hosted behind a reverse proxy (nginx + our own sidecar): `nextUrl`
  // reflects the address Next.js itself is bound to (127.0.0.1:<internal
  // port>), NOT the client-facing Host — it does not read the incoming Host
  // header. Redirect targets built from `nextUrl` therefore point at
  // "localhost:<internal port>" instead of the real domain. Build the origin
  // from the forwarded headers (set by nginx) instead, and use that as the
  // base for every `new URL(path, ...)` redirect below.
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? nextUrl.host
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? nextUrl.protocol.replace(':', '')
  const origin = `${forwardedProto}://${forwardedHost}`

  // Always allow NextAuth API routes
  if (publicApiRoutes.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Decode JWT from cookie — edge-safe, no Node.js deps
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Behind a reverse proxy the request reaches Node over plain HTTP, so getToken()'s
    // protocol-based guess picks the wrong cookie name (missing __Secure- prefix) and
    // never finds the session — causing a redirect loop with server components that use
    // auth() (which correctly trusts AUTH_URL/AUTH_TRUST_HOST). Force it explicitly.
    secureCookie: process.env.AUTH_URL?.startsWith('https://') ?? process.env.NODE_ENV === 'production',
  })
  const isAuthenticated = !!token

  // API routes: require session, no i18n handling
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (pathname.startsWith('/api/admin') && token?.isAdmin !== true) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // Detect locale prefix (e.g. /en/... or /vi/...)
  const localeMatch = LOCALE_PATTERN.exec(pathname)
  const locale = localeMatch?.[1] ?? DEFAULT_LOCALE
  const localePath = localeMatch
    ? pathname.slice(localeMatch[0].length - (localeMatch[2] === '/' ? 1 : 0))
    : pathname

  // No locale prefix → redirect to default locale version first
  if (!localeMatch) {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}`, origin))
  }

  // Admin login — public, but bounce already-authenticated admins straight to the CMS.
  // Must be checked before the generic authRoutes match below, since '/admin/login' also
  // ends with '/login' and would otherwise be treated as the regular login page.
  if (localePath === '/admin/login') {
    if (isAuthenticated && token?.isAdmin === true) {
      return NextResponse.redirect(new URL(`/${locale}/admin`, origin))
    }
    return NextResponse.next()
  }

  // Admin CMS — requires an authenticated session AND isAdmin === true
  if (localePath === '/admin' || localePath.startsWith('/admin/')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, origin))
    }
    if (token?.isAdmin !== true) {
      return NextResponse.redirect(new URL(`/${locale}/admin/login?error=forbidden`, origin))
    }
    return NextResponse.next()
  }

  // Auth pages (/login, /register) — redirect to dashboard if already signed in
  if (authRoutes.some(r => localePath.endsWith(r))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, origin))
    }
    return NextResponse.next()
  }

  // Protected pages — require session
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL(`/${locale}/login`, origin))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
