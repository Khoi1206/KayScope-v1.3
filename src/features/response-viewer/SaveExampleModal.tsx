'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useExampleStore } from '@/store/example.store'
import type { ResponseData, KVPair, RequestBody, RequestAuth } from '@/store/request.store'

interface RequestSnapshot {
  method?: string
  url?: string
  params?: KVPair[]
  headers?: KVPair[]
  body?: RequestBody
  auth?: RequestAuth
}

interface Props {
  requestId: string
  response: ResponseData
  requestSnapshot?: RequestSnapshot
  onClose: () => void
}

export default function SaveExampleModal({ requestId, response, requestSnapshot, onClose }: Props) {
  const t = useTranslations('examples')
  const tc = useTranslations('common')
  const { createExample } = useExampleStore()

  const defaultName = response.status > 0
    ? `${response.status} ${response.statusText}`.trim()
    : 'Example'

  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createExample(requestId, {
        name: name.trim(),
        status: response.status || undefined,
        statusText: response.statusText || undefined,
        responseHeaders: Object.keys(response.headers).length > 0 ? response.headers : undefined,
        responseBody: response.body ? response.body.slice(0, 51_200) : undefined,
        durationMs: response.durationMs || undefined,
        size: response.size || undefined,
        requestMethod: requestSnapshot?.method,
        requestUrl: requestSnapshot?.url,
        requestParams: requestSnapshot?.params,
        requestHeaders: requestSnapshot?.headers,
        requestBody: requestSnapshot?.body,
        requestAuth: requestSnapshot?.auth,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="flex w-[420px] flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-th-border px-5 py-4">
          <h2 className="text-sm font-semibold text-th-fg">{t('saveAsExample')}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-medium text-th-fg-muted">
            {tc('name')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('namePlaceholder')}
            className="w-full rounded-md border border-th-border bg-th-surface px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:border-th-accent focus:outline-none"
          />
          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-90"
          >
            {saving ? tc('loading') : tc('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
