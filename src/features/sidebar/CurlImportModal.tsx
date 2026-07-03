'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { parseCurl } from '@/lib/curl-import'
import { useRequestStore } from '@/store/request.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  onClose: () => void
}

function nanoid() {
  return Math.random().toString(36).slice(2, 11)
}

export default function CurlImportModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const ti = useTranslations('import')
  const tc = useTranslations('common')
  const openTab = useRequestStore(s => s.openTab)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleImport() {
    setError(null)
    try {
      const parsed = parseCurl(value.trim())
      const id = nanoid()
      openTab(
        { id, title: parsed.url || 'Imported Request' },
        {
          method: parsed.method,
          url: parsed.url,
          params: parsed.params,
          headers: parsed.headers,
          body: parsed.body,
          auth: parsed.auth,
        }
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : ti('error'))
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="flex w-[600px] flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-th-border px-4 py-3">
          <h2 className="text-sm font-semibold text-th-fg">{ti('title')}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={ti('curlPlaceholder')}
            rows={8}
            autoFocus
            className="w-full rounded border border-th-border bg-th-input px-3 py-2 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent resize-none"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-th-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleImport}
            disabled={!value.trim()}
            className="rounded bg-th-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {ti('import')}
          </button>
        </div>
      </div>
    </div>
  )
}
