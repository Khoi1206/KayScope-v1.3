'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Layers, Folder, FileText } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useCollectionStore } from '@/store/collection.store'
import { useRequestStore } from '@/store/request.store'

interface SearchResult {
  type: 'collection' | 'folder' | 'request'
  id: string
  name: string
  subtitle?: string
  collectionId?: string
  method?: string
  url?: string
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400', POST: 'text-blue-400', PUT: 'text-yellow-400',
  PATCH: 'text-orange-400', DELETE: 'text-red-400', HEAD: 'text-purple-400', OPTIONS: 'text-cyan-400',
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function GlobalSearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { collections, folders, requests: storeRequests, fetchFolders, fetchRequests, setExpanded, toggleExpanded } = useCollectionStore()
  const { openTab, snapshots } = useRequestStore()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const results: SearchResult[] = []
  if (query.trim().length >= 1) {
    const q = query.trim().toLowerCase()

    for (const col of collections) {
      if (col.name.toLowerCase().includes(q)) {
        results.push({ type: 'collection', id: col.id, name: col.name, subtitle: 'Collection' })
      }
      const colFolders = folders[col.id] ?? []
      for (const folder of colFolders) {
        if (folder.name.toLowerCase().includes(q)) {
          results.push({ type: 'folder', id: folder.id, name: folder.name, subtitle: col.name, collectionId: col.id })
        }
      }
      const colRequests = storeRequests[col.id] ?? []
      for (const req of colRequests) {
        if (req.name.toLowerCase().includes(q) || req.url?.toLowerCase().includes(q)) {
          const folder = req.folderId ? colFolders.find(f => f.id === req.folderId) : undefined
          const subtitle = folder ? `${col.name} / ${folder.name}` : col.name
          results.push({ type: 'request', id: req.id, name: req.name, subtitle, collectionId: col.id, method: req.method, url: req.url })
        }
      }
    }
  }

  // Lazy-load folders/requests for each collection when searching
  useEffect(() => {
    if (!query.trim()) return
    for (const col of collections) {
      if (!folders[col.id]) fetchFolders(col.id)
      if (!storeRequests[col.id]) fetchRequests(col.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, collections.length])

  const safeSelected = Math.min(selected, Math.max(0, results.length - 1))

  function handleSelect(result: SearchResult) {
    if (result.type === 'request' && result.collectionId) {
      const colRequests = storeRequests[result.collectionId] ?? []
      const req = colRequests.find(r => r.id === result.id)
      if (req) {
        // Expand the collection in sidebar
        setExpanded(result.collectionId, true)
        if (req.folderId) setExpanded(req.folderId, true)
        // Open the tab
        const existingSnap = Object.entries(snapshots).find(([, s]) => s && 'requestId' in s)
        void existingSnap
        openTab(
          { id: result.id, title: req.name, requestId: req.id, collectionId: result.collectionId },
          {
            method: req.method || 'GET',
            url: req.url || '',
            params: req.params ?? [],
            headers: req.headers ?? [],
            body: req.body
              ? { ...req.body, content: req.body.content ?? '' } as import('@/store/request.store').RequestBody
              : { type: 'none', content: '' },
            auth: req.auth ?? { type: 'none' },
            preRequestScript: req.preRequestScript ?? '',
            postRequestScript: req.postRequestScript ?? '',
          }
        )
      }
    } else if (result.type === 'collection') {
      toggleExpanded(result.id)
    } else if (result.type === 'folder' && result.collectionId) {
      setExpanded(result.collectionId, true)
      toggleExpanded(result.id)
    }
    onClose()
  }

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter' && results[safeSelected]) { handleSelect(results[safeSelected]!); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, safeSelected])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[safeSelected] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [safeSelected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-th-border bg-th-raised shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-th-border px-4 py-3">
          <Search size={16} className="shrink-0 text-th-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search collections, folders, requests…"
            className="flex-1 bg-transparent text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0 text-th-fg-muted hover:text-th-fg">
              <X size={14} />
            </button>
          )}
          <kbd className="shrink-0 rounded bg-th-surface px-1.5 py-0.5 text-[10px] font-medium text-th-fg-subtle">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1">
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-th-fg-subtle">
              Type to search across all collections, folders, and requests
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-th-fg-subtle">No results for &ldquo;{query}&rdquo;</div>
          )}
          {results.map((result, i) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                i === safeSelected ? 'bg-th-accent/15 text-th-fg' : 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
              )}
            >
              {/* Icon */}
              <span className={cn('shrink-0', i === safeSelected ? 'text-th-accent' : 'text-th-fg-subtle')}>
                {result.type === 'collection' && <Layers size={14} />}
                {result.type === 'folder' && <Folder size={14} />}
                {result.type === 'request' && <FileText size={14} />}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {result.method && (
                    <span className={cn('shrink-0 text-[10px] font-bold', METHOD_COLORS[result.method] ?? 'text-th-fg-muted')}>
                      {result.method}
                    </span>
                  )}
                  <span className="truncate text-sm font-medium">{result.name}</span>
                </div>
                {result.subtitle && (
                  <span className="truncate text-[11px] text-th-fg-subtle">{result.subtitle}</span>
                )}
                {result.url && result.type === 'request' && (
                  <span className="truncate block font-mono text-[10px] text-th-fg-subtle opacity-70">{result.url}</span>
                )}
              </div>

              {/* Type badge */}
              <span className="shrink-0 rounded bg-th-surface px-1.5 py-0.5 text-[10px] capitalize text-th-fg-subtle">
                {result.type}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-th-border px-4 py-2 text-[11px] text-th-fg-subtle">
          <span><kbd className="rounded bg-th-surface px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate</span>
          <span><kbd className="rounded bg-th-surface px-1 py-0.5 font-mono text-[10px]">Enter</kbd> open</span>
          <span><kbd className="rounded bg-th-surface px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
