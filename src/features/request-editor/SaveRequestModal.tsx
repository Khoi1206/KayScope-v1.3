'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Database, FolderClosed, ChevronRight, Plus } from 'lucide-react'
import { useCollectionStore } from '@/store/collection.store'
import { getWorkspaceHeaders } from '@/store/workspace.store'
import type { TabSnapshot } from '@/store/request.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  initialName: string
  snapshot: TabSnapshot
  onClose: () => void
  onSaved: (requestId: string, collectionId: string, folderId: string | null, savedName: string) => void
}

type NavCollection = { type: 'collection'; id: string; name: string }
type NavFolder = { type: 'folder'; id: string; name: string; collectionId: string }
type NavItem = NavCollection | NavFolder

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
}

export default function SaveRequestModal({ initialName, snapshot, onClose, onSaved }: Props) {
  const t = useTranslations('request.saveModal')
  const { collections, folders, requests, fetchFolders, fetchRequests, createCollection, createFolder } =
    useCollectionStore()

  const [name, setName] = useState(initialName || 'Untitled Request')
  const [navStack, setNavStack] = useState<NavItem[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [creatingNew, setCreatingNew] = useState(false)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEscapeKey(() => { if (!showNewInput) onClose() })

  // Derived navigation state
  const currentCollection = navStack.find((n): n is NavCollection => n.type === 'collection')
  const folderItems = navStack.filter((n): n is NavFolder => n.type === 'folder')
  const currentFolder = folderItems[folderItems.length - 1]
  const canSave = navStack.length > 0

  // Load data when navigating deeper
  useEffect(() => {
    if (!currentCollection) return
    const colId = currentCollection.id

    const foldersNeeded = !folders[colId]
    const requestsNeeded = !requests[colId]

    if (foldersNeeded) {
      setLoading(true)
      Promise.all([
        fetchFolders(colId),
        requestsNeeded ? fetchRequests(colId) : Promise.resolve(),
      ]).finally(() => setLoading(false))
    } else if (requestsNeeded) {
      fetchRequests(colId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navStack.length])

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus()
  }, [showNewInput])

  // Build list for current level
  const currentList = (() => {
    if (!currentCollection) {
      const items = collections.filter(
        c => !search || c.name.toLowerCase().includes(search.toLowerCase()),
      )
      return { kind: 'collections' as const, items }
    }
    const q = search.toLowerCase()
    if (!currentFolder) {
      const colFolders = (folders[currentCollection.id] ?? [])
        .filter(f => !f.parentFolderId)
        .filter(f => !q || f.name.toLowerCase().includes(q))
      const rootRequests = (requests[currentCollection.id] ?? [])
        .filter(r => !r.folderId)
        .filter(r => !q || r.name.toLowerCase().includes(q))
      return { kind: 'mixed' as const, folders: colFolders, requests: rootRequests }
    }
    const colRequests = (requests[currentCollection.id] ?? [])
      .filter(r => r.folderId === currentFolder.id)
      .filter(r => !q || r.name.toLowerCase().includes(q))
    return { kind: 'mixed' as const, folders: [], requests: colRequests }
  })()

  function drillInto(item: NavItem) {
    setSearch('')
    setShowNewInput(false)
    setNewItemName('')
    setNavStack(prev => [...prev, item])
  }

  function navigateTo(index: number) {
    setSearch('')
    setShowNewInput(false)
    setNavStack(prev => prev.slice(0, index + 1))
  }

  function navigateToRoot() {
    setSearch('')
    setShowNewInput(false)
    setNavStack([])
  }

  async function handleCreateNew() {
    const trimmed = newItemName.trim()
    if (!trimmed) return
    setCreatingNew(true)
    setError(null)
    try {
      if (!currentCollection) {
        const col = await createCollection(trimmed)
        setShowNewInput(false)
        setNewItemName('')
        drillInto({ type: 'collection', id: col.id, name: col.name })
      } else {
        const folder = await createFolder(
          currentCollection.id,
          trimmed,
          currentFolder?.id,
        )
        setShowNewInput(false)
        setNewItemName('')
        drillInto({ type: 'folder', id: folder.id, name: folder.name, collectionId: currentCollection.id })
      }
    } catch {
      setError('Failed to create')
    } finally {
      setCreatingNew(false)
    }
  }

  async function handleSave() {
    if (!currentCollection) {
      setError(t('errorNoCollection'))
      return
    }
    const trimmedName = name.trim() || 'Untitled Request'
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
        body: JSON.stringify({
          collectionId: currentCollection.id,
          folderId: currentFolder?.id ?? undefined,
          name: trimmedName,
          method: snapshot.method,
          url: snapshot.url,
          params: snapshot.params,
          headers: snapshot.headers,
          body: snapshot.body,
          auth: snapshot.auth,
          preRequestScript: snapshot.preRequestScript || undefined,
          postRequestScript: snapshot.postRequestScript || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t('errorSave'))
      }
      const request = await res.json()
      onSaved(request.id, currentCollection.id, currentFolder?.id ?? null, trimmedName)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">

        {/* Title */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-xs font-bold uppercase tracking-widest text-th-fg">{t('title')}</p>
        </div>

        {/* Request name */}
        <div className="flex flex-col gap-1.5 px-5 pb-3">
          <label className="text-xs font-medium text-th-fg-muted">Request name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
            className="w-full rounded border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:border-th-accent focus:outline-none"
          />
        </div>

        {/* Save to breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 px-5 pb-2 text-sm">
          <span className="text-th-fg-muted">Save to</span>
          {navStack.length === 0 ? (
            <span className="text-th-fg-subtle">Select a collection/folder</span>
          ) : (
            <div className="flex flex-wrap items-center gap-0.5">
              <button
                onClick={navigateToRoot}
                className="rounded px-0.5 text-th-fg-muted transition-colors hover:text-th-fg"
              >
                My Workspace
              </button>
              {navStack.map((item, i) => (
                <span key={item.id} className="flex items-center gap-0.5">
                  <ChevronRight size={12} className="text-th-fg-muted" />
                  {i < navStack.length - 1 ? (
                    <button
                      onClick={() => navigateTo(i)}
                      className="rounded px-0.5 text-th-fg-muted transition-colors hover:text-th-fg"
                    >
                      {item.name}
                    </button>
                  ) : (
                    <span className="rounded px-0.5 font-semibold text-th-fg">{item.name}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* List panel */}
        <div className="mx-5 mb-1 flex flex-col overflow-hidden rounded-md border border-th-border bg-th-surface" style={{ height: 264 }}>
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b border-th-border px-3 py-2">
            <Search size={12} className="shrink-0 text-th-fg-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for collection or folder"
              className="flex-1 bg-transparent text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none"
            />
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-th-fg-muted">
                Loading…
              </div>
            ) : currentList.kind === 'collections' ? (
              currentList.items.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-th-fg-muted">No collections</div>
              ) : (
                currentList.items.map(col => (
                  <button
                    key={col.id}
                    onClick={() => drillInto({ type: 'collection', id: col.id, name: col.name })}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-th-surface-hover"
                  >
                    <Database size={14} className="shrink-0 text-th-fg-muted" />
                    <span className="flex-1">{col.name}</span>
                  </button>
                ))
              )
            ) : currentList.folders.length === 0 && currentList.requests.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-th-fg-muted">Empty</div>
            ) : (
              <>
                {currentList.folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() =>
                      drillInto({ type: 'folder', id: f.id, name: f.name, collectionId: currentCollection!.id })
                    }
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-th-surface-hover"
                  >
                    <FolderClosed size={14} className="shrink-0 text-th-fg-muted" />
                    <span className="flex-1">{f.name}</span>
                  </button>
                ))}
                {currentList.requests.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm opacity-60">
                    <span className={`w-9 shrink-0 text-[10px] font-bold uppercase ${METHOD_COLOR[r.method] ?? 'text-th-fg-muted'}`}>
                      {r.method}
                    </span>
                    <span className="truncate text-th-fg-muted">{r.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Inline new-item input */}
          {showNewInput && (
            <div className="flex items-center gap-2 border-t border-th-border bg-th-bg px-3 py-2">
              <input
                ref={newInputRef}
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateNew()
                  if (e.key === 'Escape') { e.stopPropagation(); setShowNewInput(false); setNewItemName('') }
                }}
                placeholder={!currentCollection ? 'Collection name…' : 'Folder name…'}
                className="flex-1 rounded border border-th-border bg-th-input px-2 py-1 text-xs text-th-fg placeholder:text-th-fg-subtle focus:border-th-accent focus:outline-none"
              />
              <button
                onClick={handleCreateNew}
                disabled={creatingNew || !newItemName.trim()}
                className="rounded bg-th-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {creatingNew ? '…' : 'Add'}
              </button>
              <button
                onClick={() => { setShowNewInput(false); setNewItemName('') }}
                className="rounded border border-th-border px-2.5 py-1 text-xs text-th-fg-muted hover:bg-th-surface-hover"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {error && <p className="px-5 pt-1 text-xs text-red-400">{error}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => { setShowNewInput(v => !v); setNewItemName('') }}
            className="flex items-center gap-1.5 text-xs text-th-fg-muted transition-colors hover:text-th-fg"
          >
            <Plus size={13} />
            {!currentCollection ? 'New collection' : 'New folder'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-th-border px-4 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
            >
              {t('cancel')}
            </button>
            <button
              disabled={!canSave || saving}
              onClick={handleSave}
              className="rounded-md bg-th-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
