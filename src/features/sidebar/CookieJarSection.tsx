'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Cookie as CookieIcon } from 'lucide-react'
import { getWorkspaceHeaders } from '@/store/workspace.store'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import ConfirmModal from '@/components/ConfirmModal'

interface CookieItem {
  id: string
  domain: string
  name: string
  value: string // masked ("••••••••") from the API
  path: string
  expires: string | null
  httpOnly: boolean
  secure: boolean
  sameSite: string | null
}

export default function CookieJarSection() {
  const [cookies, setCookies] = useState<CookieItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CookieItem | { domain: string } | null>(null)

  async function fetchCookies() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cookies', { headers: getWorkspaceHeaders() })
      if (!res.ok) throw new Error('Failed to load cookies')
      setCookies(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCookies()
  }, [])

  async function handleAdd(data: { domain: string; name: string; value: string; path: string }) {
    await fetch('/api/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify(data),
    })
    setShowAdd(false)
    fetchCookies()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const params = 'id' in deleteTarget
      ? `id=${encodeURIComponent(deleteTarget.id)}`
      : `domain=${encodeURIComponent(deleteTarget.domain)}`
    await fetch(`/api/cookies?${params}`, { method: 'DELETE', headers: getWorkspaceHeaders() })
    setDeleteTarget(null)
    fetchCookies()
  }

  const byDomain = cookies.reduce<Record<string, CookieItem[]>>((acc, c) => {
    (acc[c.domain] ??= []).push(c)
    return acc
  }, {})
  const domains = Object.keys(byDomain).sort()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          Cookies
        </span>
        <button
          onClick={() => setShowAdd(true)}
          title="Add cookie"
          className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {loading && cookies.length === 0 && (
          <>
            {Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} />)}
          </>
        )}
        {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}

        {!loading && domains.length === 0 && (
          <p className="px-3 py-4 text-xs text-th-fg-subtle">
            No cookies yet. Cookies are saved automatically from{' '}
            <code className="rounded bg-th-surface px-1 py-0.5 font-mono">Set-Cookie</code> response
            headers, or add one manually.
          </p>
        )}

        {domains.map(domain => (
          <div key={domain} className="mb-1">
            <div className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-th-surface-hover">
              <button
                onClick={() => setExpanded(s => ({ ...s, [domain]: !s[domain] }))}
                className="flex flex-1 items-center gap-1.5 text-left text-xs text-th-fg"
              >
                {expanded[domain] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <CookieIcon size={13} className="text-th-fg-muted" />
                <span className="min-w-0 flex-1 truncate font-medium">{domain}</span>
                <span className="text-[10px] text-th-fg-subtle">{byDomain[domain]!.length}</span>
              </button>
              <button
                onClick={() => setDeleteTarget({ domain })}
                title="Delete all cookies for this domain"
                className="rounded p-1 text-th-fg-muted opacity-0 transition-colors hover:bg-th-surface hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {expanded[domain] && (
              <div className="ml-4 border-l border-th-border pl-2">
                {byDomain[domain]!.map(c => (
                  <div key={c.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-th-surface-hover">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-th-fg">{c.name}</div>
                      <div className="truncate text-[10px] text-th-fg-subtle">
                        {c.value} · {c.path}
                        {c.expires && ` · expires ${new Date(c.expires).toLocaleString()}`}
                        {c.httpOnly && ' · HttpOnly'}
                        {c.secure && ' · Secure'}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="rounded p-1 text-th-fg-muted opacity-0 transition-colors hover:bg-th-surface hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && <AddCookieModal onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {deleteTarget && (
        <ConfirmModal
          title="Delete cookie"
          message={'id' in deleteTarget
            ? `Delete cookie "${deleteTarget.name}" for ${deleteTarget.domain}?`
            : `Delete all cookies for ${deleteTarget.domain}?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function AddCookieModal({
  onSave, onClose,
}: {
  onSave: (data: { domain: string; name: string; value: string; path: string }) => void
  onClose: () => void
}) {
  const [domain, setDomain] = useState('')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [path, setPath] = useState('/')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">Add Cookie</p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <Field label="Domain"><input value={domain} onChange={e => setDomain(e.target.value)} placeholder="api.example.com" className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none" /></Field>
          <Field label="Name"><input value={name} onChange={e => setName(e.target.value)} placeholder="session_id" className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none" /></Field>
          <Field label="Value"><input value={value} onChange={e => setValue(e.target.value)} className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none" /></Field>
          <Field label="Path"><input value={path} onChange={e => setPath(e.target.value)} className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none" /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover">Cancel</button>
          <button
            onClick={() => domain && name && onSave({ domain, name, value, path })}
            disabled={!domain || !name}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-th-fg-muted">{label}</span>
      {children}
    </label>
  )
}
