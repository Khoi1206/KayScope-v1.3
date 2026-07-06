import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Keep locale constants here — do NOT import @/i18n/routing in middleware.
// That module calls createNavigation() at module scope which is not Edge-compatible
// and causes Next.js to silently drop the middleware (empty middleware manifest).
const DEFAULT_LOCALE = 'en'
const LOCALE_PATTERN = /^\/(en|vi)(\/|$)/

const authRoutes = ['/login', '/register']
const publicApiRoutes = ['/api/auth']

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  // Always allow NextAuth API routes
  if (publicApiRoutes.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Decode JWT from cookie — edge-safe, no Node.js deps
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
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
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${pathname}`, nextUrl))
  }

  // Admin login — public, but bounce already-authenticated admins straight to the CMS.
  // Must be checked before the generic authRoutes match below, since '/admin/login' also
  // ends with '/login' and would otherwise be treated as the regular login page.
  if (localePath === '/admin/login') {
    if (isAuthenticated && token?.isAdmin === true) {
      return NextResponse.redirect(new URL(`/${locale}/admin`, nextUrl))
    }
    return NextResponse.next()
  }

  // Admin CMS — requires an authenticated session AND isAdmin === true
  if (localePath === '/admin' || localePath.startsWith('/admin/')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, nextUrl))
    }
    if (token?.isAdmin !== true) {
      return NextResponse.redirect(new URL(`/${locale}/admin/login?error=forbidden`, nextUrl))
    }
    return NextResponse.next()
  }

  // Auth pages (/login, /register) — redirect to dashboard if already signed in
  if (authRoutes.some(r => localePath.endsWith(r))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl))
    }
    return NextResponse.next()
  }

  // Protected pages — require session
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL(`/${locale}/login`, nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
