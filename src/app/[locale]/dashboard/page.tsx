'use client'

import { useEffect, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import WorkspaceShell from './WorkspaceShell'

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const [session, setSession] = useState<{ id: string; name: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then((s: { user?: { id: string; name?: string | null } } | null) => {
        if (s?.user) setSession({ id: s.user.id, name: s.user.name ?? null })
      })
      .catch(() => {})
  }, [])

  return (
    <AuthGuard locale={locale} mode="require-auth">
      {session && <WorkspaceShell userId={session.id} userName={session.name} />}
    </AuthGuard>
  )
}
