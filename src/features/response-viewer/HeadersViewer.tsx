'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'

interface Props {
  headers: Record<string, string>
}

export default function HeadersViewer({ headers }: Props) {
  const [query, setQuery] = useState('')

  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return <p className="px-4 py-4 text-xs text-th-fg-subtle">No response headers</p>
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? entries.filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
    : entries

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-th-border bg-th-bg px-3 py-1.5">
        <Search size={12} className="shrink-0 text-th-fg-muted" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Filter ${entries.length} headers…`}
          className="min-w-0 flex-1 bg-transparent text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none"
        />
        {q && (
          <>
            <span className="shrink-0 text-[10px] text-th-fg-muted">{filtered.length} / {entries.length}</span>
            <button onClick={() => setQuery('')} className="shrink-0 rounded p-0.5 text-th-fg-muted hover:text-th-fg">
              <X size={12} />
            </button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-4 text-xs text-th-fg-subtle">No headers match &ldquo;{query}&rdquo;</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-th-border">
              <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Header</th>
              <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([key, value]) => (
              <tr key={key} className="border-b border-th-border/30 transition-colors hover:bg-th-surface-hover">
                <td className="w-56 px-4 py-2 font-mono font-medium text-th-accent">{key}</td>
                <td className="px-4 py-2 font-mono text-th-fg-muted break-all">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
