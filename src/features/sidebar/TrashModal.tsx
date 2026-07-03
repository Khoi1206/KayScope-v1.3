'use client'

import { useEffect, useState } from 'react'
import { Trash2, RotateCcw, FolderOpen, FileText } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { getWorkspaceHeaders } from '@/store/workspace.store'
import { useCollectionStore } from '@/store/collection.store'
import ConfirmModal from '@/components/ConfirmModal'

interface TrashCollection { id: string; name: string; deletedAt: string }
interface TrashRequest { id: string; name: string; collectionId: string; deletedAt: string }

export default function TrashModal({ onClose }: { onClose: () => void }) {
  useEscapeKey(onClose)
  const { fetchCollections } = useCollectionStore()
  const [collections, setCollections] = useState<TrashCollection[]>([])
  const [requests, setRequests] = useState<TrashRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [purgeTarget, setPurgeTarget] = useState<{ type: 'collection' | 'request'; id: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/trash', { headers: getWorkspaceHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setCollections(data.collections ?? [])
      setRequests(data.requests ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function restoreCollection(id: string) {
    await fetch(`/api/collections/${id}/restore`, { method: 'POST', headers: getWorkspaceHeaders() })
    await Promise.all([load(), fetchCollections()])
  }

  async function restoreRequest(id: string) {
    await fetch(`/api/requests/${id}/restore`, { method: 'POST', headers: getWorkspaceHeaders() })
    await load()
  }

  async function confirmPurge() {
    if (!purgeTarget) return
    await fetch(`/api/trash?type=${purgeTarget.type}&id=${purgeTarget.id}`, { method: 'DELETE', headers: getWorkspaceHeaders() })
    setPurgeTarget(null)
    await load()
  }

  const isEmpty = !loading && collections.length === 0 && requests.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">Trash</p>
          <p className="mt-0.5 text-[11px] text-th-fg-muted">Deleted collections and requests can be restored or permanently removed</p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && <p className="px-3 py-4 text-xs text-th-fg-subtle">Loading…</p>}
          {isEmpty && <p className="px-3 py-4 text-xs text-th-fg-subtle">Trash is empty</p>}

          {collections.map(c => (
            <div key={c.id} className="group flex items-center gap-2 rounded-md px-3 py-2 hover:bg-th-surface-hover">
              <FolderOpen size={13} className="shrink-0 text-th-fg-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-th-fg">{c.name}</div>
                <div className="text-[10px] text-th-fg-subtle">Collection · deleted {new Date(c.deletedAt).toLocaleString()}</div>
              </div>
              <button onClick={() => restoreCollection(c.id)} title="Restore" className="rounded p-1 text-th-fg-muted hover:bg-th-surface hover:text-th-accent">
                <RotateCcw size={12} />
              </button>
              <button onClick={() => setPurgeTarget({ type: 'collection', id: c.id, name: c.name })} title="Delete forever" className="rounded p-1 text-th-fg-muted hover:bg-th-surface hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {requests.map(r => (
            <div key={r.id} className="group flex items-center gap-2 rounded-md px-3 py-2 hover:bg-th-surface-hover">
              <FileText size={13} className="shrink-0 text-th-fg-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-th-fg">{r.name}</div>
                <div className="text-[10px] text-th-fg-subtle">Request · deleted {new Date(r.deletedAt).toLocaleString()}</div>
              </div>
              <button onClick={() => restoreRequest(r.id)} title="Restore" className="rounded p-1 text-th-fg-muted hover:bg-th-surface hover:text-th-accent">
                <RotateCcw size={12} />
              </button>
              <button onClick={() => setPurgeTarget({ type: 'request', id: r.id, name: r.name })} title="Delete forever" className="rounded p-1 text-th-fg-muted hover:bg-th-surface hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-th-border px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover">
            Close
          </button>
        </div>
      </div>

      {purgeTarget && (
        <ConfirmModal
          title="Delete forever"
          message={`Permanently delete "${purgeTarget.name}"? This cannot be undone.`}
          onConfirm={confirmPurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}
    </div>
  )
}
