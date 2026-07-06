'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface WorkspaceRow {
  id: string
  name: string
  type: string
  description: string | null
  createdAt: string
  role?: string
}

interface Props {
  user: { id: string; name: string; email: string }
  onClose: () => void
}

export default function AdminUserWorkspacesModal({ user, onClose }: Props) {
  const t = useTranslations('admin.workspacesModal')
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEscapeKey(onClose)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/users/${user.id}/workspaces`)
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t('failedToLoad'))
        return res.json()
      })
      .then(data => {
        if (!cancelled) setWorkspaces(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('failedToLoad'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">{t('title', { name: user.name })}</p>
          <p className="text-xs text-th-fg-muted">{user.email}</p>
        </div>

        <div className="max-h-80 overflow-y-auto px-5 py-3">
          {loading && <p className="py-4 text-center text-xs text-th-fg-subtle">{t('loading')}</p>}
          {error && <p className="py-4 text-center text-xs text-th-error">{error}</p>}
          {!loading && !error && workspaces.length === 0 && (
            <p className="py-4 text-center text-xs text-th-fg-subtle">{t('noWorkspaces')}</p>
          )}
          {!loading && workspaces.length > 0 && (
            <ul className="divide-y divide-th-border/50">
              {workspaces.map(ws => (
                <li key={ws.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-th-fg">{ws.name}</p>
                    <p className="text-xs text-th-fg-muted">{ws.type}</p>
                  </div>
                  <span className="rounded-full bg-th-surface-hover px-2 py-0.5 text-xs text-th-fg-muted">
                    {ws.role ?? t('owner')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
