'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface AuditLogRow {
  id: string
  actorId: string
  actorEmail: string
  action:
    | 'grant_admin'
    | 'revoke_admin'
    | 'activate_user'
    | 'deactivate_user'
    | 'delete_user'
    | 'create_user'
    | 'update_user'
  targetUserId: string
  targetUserEmail: string
  targetUserName: string
  createdAt: string
}

export default function AdminLogsPanel() {
  const t = useTranslations('admin.auditLog')
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/audit-logs')
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t('failedToLoad'))
        return res.json()
      })
      .then(data => {
        if (!cancelled) setLogs(data)
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
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <h2 className="mb-1 text-base font-semibold text-th-fg">{t('title')}</h2>
      <p className="mb-5 text-xs text-th-fg-muted">{t('subtitle')}</p>

      {loading && <p className="text-xs text-th-fg-subtle">{t('loading')}</p>}
      {error && <p className="text-xs text-th-error">{error}</p>}
      {!loading && !error && logs.length === 0 && (
        <p className="text-xs text-th-fg-subtle">{t('empty')}</p>
      )}
      {!loading && !error && logs.length > 0 && (
        <div className="overflow-hidden rounded-md border border-th-border">
          <table className="w-full text-xs">
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-t border-th-border/50 first:border-t-0 hover:bg-th-surface-hover">
                  <td className="px-3 py-2 text-th-fg">
                    {t('entry', {
                      actor: log.actorEmail,
                      action: t(`action_${log.action}`),
                      target: `${log.targetUserName} (${log.targetUserEmail})`,
                    })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top text-th-fg-muted">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
