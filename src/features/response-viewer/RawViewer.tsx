'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  body: string
}

const ESC_RE = /[.*+?^${}()|[\]\\]/g

export default function RawViewer({ body }: Props) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Only intercept when the active element is not Monaco or another focused editor
        const tag = document.activeElement?.tagName.toLowerCase()
        if (tag === 'textarea') return
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => inputRef.current?.focus(), 30)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])

  if (!body) return <p className="px-4 py-4 text-xs text-th-fg-subtle">No response body</p>

  const formatted = (() => {
    try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
  })()

  // Count matches
  const q = query.trim()
  let matchCount = 0
  if (q) {
    const re = new RegExp(q.replace(ESC_RE, '\\$&'), 'gi')
    matchCount = (formatted.match(re) ?? []).length
  }

  // Build highlighted segments
  function renderHighlighted() {
    if (!q) return <span>{formatted}</span>
    const re = new RegExp(`(${q.replace(ESC_RE, '\\$&')})`, 'gi')
    const parts = formatted.split(re)
    // split with a capturing group: even indices are plain text, odd indices are captures
    return (
      <>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <mark key={i} className="rounded-sm bg-yellow-400/30 text-yellow-200">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-th-border bg-th-bg px-3 py-1.5">
          <Search size={12} className="shrink-0 text-th-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setSearchOpen(false); setQuery('') }
            }}
            placeholder="Find in response…"
            className="min-w-0 flex-1 bg-transparent text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none"
          />
          {q && (
            <span className="shrink-0 text-[10px] text-th-fg-muted">
              {matchCount === 0 ? 'No matches' : `${matchCount} match${matchCount > 1 ? 'es' : ''}`}
            </span>
          )}
          <button
            onClick={() => { setSearchOpen(false); setQuery('') }}
            className="shrink-0 rounded p-0.5 text-th-fg-muted hover:text-th-fg"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {!searchOpen && (
        <div className="flex shrink-0 items-center justify-end px-3 py-1">
          <button
            onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 30) }}
            title="Find in response (Ctrl+F)"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-th-fg-subtle hover:bg-th-surface-hover hover:text-th-fg-muted"
          >
            <Search size={10} />
            <span>Find</span>
          </button>
        </div>
      )}
      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all px-4 py-2 font-mono text-xs text-th-fg">
        {renderHighlighted()}
      </pre>
    </div>
  )
}
