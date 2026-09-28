'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client-side session check — the ONLY enforcement available in the Electron
 * static-export build (no middleware.ts there), and a harmless defense-in-depth
 * layer for the SSR web app (middleware.ts already redirects before this ever
 * mounts). Spike for KayScope Desktop's Phase 1 §3 — see ../../KayScope-desktop v1.3/CLAUDE.md.
 */
type Mode = 'require-auth' | 'redirect-if-auth'

interface Props {
  locale: string
  mode: Mode
  children: React.ReactNode
}

export default function AuthGuard({ locale, mode, children }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session')
      .then(res => res.json())
      .then((session: { user?: { id: string } } | null) => {
        if (cancelled) return
        const authenticated = Boolean(session?.user)
        setStatus(authenticated ? 'authenticated' : 'unauthenticated')
        if (mode === 'require-auth' && !authenticated) {
          router.replace(`/${locale}/login`)
        } else if (mode === 'redirect-if-auth' && authenticated) {
          router.replace(`/${locale}/dashboard`)
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated')
      })
    return () => { cancelled = true }
  }, [locale, mode, router])

  const showChildren = mode === 'require-auth' ? status === 'authenticated' : status !== 'authenticated'
  if (!showChildren) return null
  return <>{children}</>
}
