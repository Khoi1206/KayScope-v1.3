'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, UserCheck, ShieldCheck, UserPlus } from 'lucide-react'

interface Stats {
  total: number
  active: number
  admins: number
  newLast7Days: number
}

export default function AdminOverview() {
  const t = useTranslations('admin.overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/stats')
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t('failedToLoad'))
        return res.json()
      })
      .then(data => {
        if (!cancelled) setStats(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('failedToLoad'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cards = [
    { label: t('totalUsers'), value: stats?.total, icon: Users, color: 'text-th-accent bg-th-accent/15' },
    { label: t('activeUsers'), value: stats?.active, icon: UserCheck, color: 'text-emerald-500 bg-emerald-500/15' },
    { label: t('adminUsers'), value: stats?.admins, icon: ShieldCheck, color: 'text-amber-500 bg-amber-500/15' },
    { label: t('newLast7Days'), value: stats?.newLast7Days, icon: UserPlus, color: 'text-sky-500 bg-sky-500/15' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <h2 className="mb-1 text-base font-semibold text-th-fg">{t('title')}</h2>
      <p className="mb-5 text-xs text-th-fg-muted">{t('subtitle')}</p>

      {error && <p className="mb-3 text-sm text-th-error">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-lg border border-th-border bg-th-surface p-4">
              <div className={`mb-3 inline-flex rounded-md p-2 ${card.color}`}>
                <Icon size={16} />
              </div>
              <p className="text-2xl font-semibold text-th-fg">
                {card.value ?? '—'}
              </p>
              <p className="mt-0.5 text-xs text-th-fg-muted">{card.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
