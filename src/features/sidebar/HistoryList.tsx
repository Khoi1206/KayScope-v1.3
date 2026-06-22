'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRequestStore } from '@/store/request.store'
import { getWorkspaceHeaders } from '@/store/workspace.store'
import { cn } from '@/components/ui/cn'
import { HistoryRowSkeleton } from '@/components/ui/Skeleton'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface HistoryEntry {
  id: string
  method: string
  url: string
  status: number | null
  statusText: string | null
  durationMs: number | null
  createdAt: string
}

interface PageResult {
  items: HistoryEntry[]
  nextCursor: { createdAt: string; id: string } | null
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-blue-500',
  PUT: 'text-yellow-500',
  PATCH: 'text-orange-500',
  DELETE: 'text-red-500',
  HEAD: 'text-purple-500',
  OPTIONS: 'text-gray-400',
}

function statusColor(status: number | null) {
  if (!status) return 'text-th-fg-muted'
  if (status < 200) return 'text-blue-400'
  if (status < 300) return 'text-green-500'
  if (status < 400) return 'text-yellow-500'
  return 'text-red-400'
}

export default function HistoryList() {
  const t = useTranslations('history')
  const openTab = useRequestStore(s => s.openTab)
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [nextCursor, setNextCursor] = useState<{ createdAt: string; id: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function load(cursor?: typeof nextCursor) {
    setLoading(true)
    try {
      const url = cursor
        ? `/api/history?cursor=${encodeURIComponent(JSON.stringify(cursor))}`
        : '/api/history'
      const res = await fetch(url, { headers: { ...getWorkspaceHeaders() } })
      if (!res.ok) return
      const data: PageResult = await res.json()
      setItems(prev => cursor ? [...prev, ...data.items] : data.items)
      setNextCursor(data.nextCursor)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function handleReplay(entry: HistoryEntry) {
    const tabId = `history-${entry.id}`
    let urlLabel = entry.url
    try { urlLabel = new URL(entry.url).pathname } catch { /* keep raw url */ }
    openTab(
      { id: tabId, title: `${entry.method} ${urlLabel}` },
      { method: entry.method, url: entry.url }
    )
  }

  // Show skeleton while the very first page is loading
  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <HistoryRowSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0 && !loading) {
    return <p className="px-3 py-4 text-xs text-th-fg-subtle">{t('empty')}</p>
  }

  return (
    <div className="flex flex-col">
      {items.map(entry => (
        <button
          key={entry.id}
          onClick={() => handleReplay(entry)}
          className="group flex flex-col gap-0.5 border-b border-th-border/40 px-3 py-2.5 text-left transition-colors hover:bg-th-surface-hover"
        >
          <div className="flex items-center gap-2">
            <span className={cn('shrink-0 font-mono text-[11px] font-bold', METHOD_COLORS[entry.method] ?? 'text-th-fg-muted')}>
              {entry.method}
            </span>
            {entry.status && (
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums', statusColor(entry.status))}>
                {entry.status}
              </span>
            )}
            {entry.durationMs && (
              <span className="ml-auto font-mono text-[11px] text-th-fg-subtle">{entry.durationMs}ms</span>
            )}
          </div>
          <span className="truncate font-mono text-xs text-th-fg-muted">{entry.url}</span>
          <span className="text-[11px] text-th-fg-subtle">{dayjs(entry.createdAt).fromNow()}</span>
        </button>
      ))}

      {nextCursor && (
        <button
          onClick={() => load(nextCursor)}
          disabled={loading}
          className="px-3 py-2.5 text-xs text-th-accent transition-colors hover:text-th-fg disabled:opacity-50"
        >
          {loading ? '…' : t('loadMore')}
        </button>
      )}
    </div>
  )
}
