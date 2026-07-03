'use client'

import { useEffect, useState } from 'react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useCollectionStore } from '@/store/collection.store'
import { getWorkspaceHeaders } from '@/store/workspace.store'

interface HistoryRequestData {
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
}

export default function SaveToCollectionModal({
  entry, onClose,
}: {
  entry: HistoryRequestData
  onClose: () => void
}) {
  useEscapeKey(onClose)
  const { collections, folders, fetchFolders, fetchRequests } = useCollectionStore()
  const [collectionId, setCollectionId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [name, setName] = useState(() => {
    try { return `${entry.method} ${new URL(entry.url).pathname}` } catch { return `${entry.method} request` }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (collectionId) fetchFolders(collectionId)
    setFolderId('')
  }, [collectionId, fetchFolders])

  async function handleSave() {
    if (!collectionId || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const headers = Object.entries(entry.requestHeaders).map(([key, value]) => ({ key, value, enabled: true }))
      const contentType = entry.requestHeaders['content-type'] ?? entry.requestHeaders['Content-Type'] ?? ''
      const body = entry.requestBody
        ? { type: 'raw' as const, content: entry.requestBody, rawType: contentType.includes('json') ? 'json' as const : 'text' as const }
        : { type: 'none' as const, content: '' }

      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
        body: JSON.stringify({
          collectionId,
          folderId: folderId || undefined,
          name: name.trim(),
          method: entry.method,
          url: entry.url,
          headers,
          body,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save request')
      }
      await fetchRequests(collectionId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">Save to Collection</p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          {error && <p className="text-xs text-red-400">{error}</p>}

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-th-fg-muted">Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-th-fg-muted">Collection</span>
            <select
              value={collectionId}
              onChange={e => setCollectionId(e.target.value)}
              className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none"
            >
              <option value="">Select a collection</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          {collectionId && (folders[collectionId]?.length ?? 0) > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-th-fg-muted">Folder (optional)</span>
              <select
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
                className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none"
              >
                <option value="">No folder (top level)</option>
                {(folders[collectionId] ?? []).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!collectionId || !name.trim() || saving}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
