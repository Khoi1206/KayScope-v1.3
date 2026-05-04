'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Pencil, Trash2, Check } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useExampleStore, type Example } from '@/store/example.store'
import type { KVPair, RequestBody, RequestAuth } from '@/store/request.store'
import PrettyViewer from './PrettyViewer'
import RawViewer from './RawViewer'
import HeadersViewer from './HeadersViewer'
import TimingViewer from './TimingViewer'
import type { ResponseData } from '@/store/request.store'

// ── Method badge colours ───────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-pink-400',
}

// ── Read-only KV table ─────────────────────────────────────────────────────

function KVTable({ rows }: { rows: KVPair[] }) {
  const active = rows.filter(r => r.enabled !== false && (r.key || r.value))
  if (!active.length) return <p className="px-4 py-6 text-xs text-th-fg-subtle">No items</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-th-border bg-th-surface text-left text-th-fg-muted">
            <th className="px-3 py-1.5 font-medium">Key</th>
            <th className="px-3 py-1.5 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {active.map((row, i) => (
            <tr key={i} className="border-b border-th-border/50">
              <td className="px-3 py-1.5 font-mono text-th-fg">{row.key}</td>
              <td className="px-3 py-1.5 font-mono text-th-fg-muted">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Read-only body viewer ──────────────────────────────────────────────────

function BodyViewer({ body }: { body: RequestBody }) {
  const effectiveType = body.type === 'json' ? 'raw' : body.type
  if (effectiveType === 'none') {
    return <p className="px-4 py-6 text-xs text-th-fg-subtle">No body</p>
  }
  if (effectiveType === 'raw') {
    const contentType = body.rawType === 'json' ? 'application/json'
      : body.rawType === 'html' ? 'text/html'
      : body.rawType === 'xml' ? 'application/xml'
      : body.rawType === 'javascript' ? 'application/javascript'
      : 'text/plain'
    return <PrettyViewer body={body.content} contentType={contentType} />
  }
  // form-data / x-www-form-urlencoded
  return <KVTable rows={body.formData ?? []} />
}

// ── Auth viewer ────────────────────────────────────────────────────────────

function AuthViewer({ auth }: { auth: RequestAuth }) {
  if (auth.type === 'none') {
    return <p className="px-4 py-6 text-xs text-th-fg-subtle">No auth</p>
  }
  return (
    <div className="px-4 py-3 text-xs">
      <p className="mb-2 font-medium text-th-fg-muted uppercase tracking-wider text-[10px]">{auth.type}</p>
      {auth.type === 'bearer' && (
        <div className="flex gap-2">
          <span className="text-th-fg-muted">Token</span>
          <span className="font-mono text-th-fg">{'•'.repeat(Math.min((auth.token?.length ?? 0), 20))}</span>
        </div>
      )}
      {auth.type === 'basic' && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2"><span className="w-20 text-th-fg-muted">Username</span><span className="font-mono text-th-fg">{auth.username}</span></div>
          <div className="flex gap-2"><span className="w-20 text-th-fg-muted">Password</span><span className="font-mono text-th-fg">{'•'.repeat(Math.min((auth.password?.length ?? 0), 16))}</span></div>
        </div>
      )}
      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2"><span className="w-20 text-th-fg-muted">Header</span><span className="font-mono text-th-fg">{auth.apiKeyHeader}</span></div>
          <div className="flex gap-2"><span className="w-20 text-th-fg-muted">Key</span><span className="font-mono text-th-fg">{'•'.repeat(Math.min((auth.apiKey?.length ?? 0), 20))}</span></div>
        </div>
      )}
    </div>
  )
}

// ── Request panel ──────────────────────────────────────────────────────────

type ReqTab = 'params' | 'headers' | 'body' | 'auth'

function RequestPanel({ example }: { example: Example }) {
  const [tab, setTab] = useState<ReqTab>('params')

  const hasData = example.requestMethod || example.requestUrl
  if (!hasData) {
    return (
      <div className="flex items-center justify-center px-4 py-6 text-xs text-th-fg-subtle">
        Request data not available (saved before this feature)
      </div>
    )
  }

  const method = example.requestMethod ?? 'GET'
  const url = example.requestUrl ?? ''
  const params = (example.requestParams as KVPair[] | null) ?? []
  const reqHeaders = (example.requestHeaders as KVPair[] | null) ?? []
  const body = (example.requestBody as RequestBody | null) ?? { type: 'none', content: '' }
  const auth = (example.requestAuth as RequestAuth | null) ?? { type: 'none' }

  const TABS: { key: ReqTab; label: string }[] = [
    { key: 'params', label: 'Params' },
    { key: 'headers', label: 'Headers' },
    { key: 'body', label: 'Body' },
    { key: 'auth', label: 'Auth' },
  ]

  return (
    <div className="flex flex-col overflow-hidden">
      {/* URL bar */}
      <div className="flex items-center gap-2 border-b border-th-border bg-th-surface px-3 py-2">
        <span className={cn('shrink-0 text-xs font-bold', METHOD_COLORS[method] ?? 'text-th-fg')}>
          {method}
        </span>
        <span className="flex-1 truncate font-mono text-xs text-th-fg">{url || '—'}</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-th-border bg-th-surface px-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              tab === key
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'params' && <KVTable rows={params} />}
        {tab === 'headers' && <KVTable rows={reqHeaders} />}
        {tab === 'body' && <BodyViewer body={body} />}
        {tab === 'auth' && <AuthViewer auth={auth} />}
      </div>
    </div>
  )
}

// ── Response panel (inline, no Save button) ────────────────────────────────

type RespTab = 'pretty' | 'raw' | 'headers' | 'timing'

function statusBadgeClass(status: number) {
  if (status === 0) return 'bg-th-border/30 text-th-fg-muted'
  if (status < 200) return 'bg-blue-500/15 text-blue-400'
  if (status < 300) return 'bg-green-500/15 text-green-400'
  if (status < 400) return 'bg-yellow-500/15 text-yellow-400'
  return 'bg-red-500/15 text-red-400'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ResponsePanel({ response }: { response: ResponseData }) {
  const [tab, setTab] = useState<RespTab>('pretty')
  const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? ''

  const TABS: { key: RespTab; label: string }[] = [
    { key: 'pretty', label: 'Pretty' },
    { key: 'raw', label: 'Raw' },
    { key: 'headers', label: 'Headers' },
    { key: 'timing', label: 'Timing' },
  ]

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b border-th-border bg-th-surface px-3 py-1 text-xs">
        {response.status > 0 ? (
          <>
            <span className={cn('rounded-md px-2 py-0.5 font-bold tabular-nums', statusBadgeClass(response.status))}>
              {response.status}
            </span>
            <span className="text-th-fg-muted">{response.statusText}</span>
            <span className="text-th-fg-subtle">·</span>
            <span className="font-mono text-th-fg-muted">{response.durationMs} <span className="text-th-fg-subtle">ms</span></span>
            <span className="text-th-fg-subtle">·</span>
            <span className="font-mono text-th-fg-muted">{formatSize(response.size)}</span>
          </>
        ) : (
          <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-400">No response</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-th-border bg-th-surface px-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              tab === key
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'pretty' && <PrettyViewer body={response.body} contentType={contentType} />}
        {tab === 'raw' && <RawViewer body={response.body} />}
        {tab === 'headers' && <HeadersViewer headers={response.headers} />}
        {tab === 'timing' && <TimingViewer response={response} />}
      </div>
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────

interface Props {
  example: Example
  requestId: string
  onClose: () => void
}

export default function ExampleViewerModal({ example, requestId, onClose }: Props) {
  const t = useTranslations('examples')
  const tc = useTranslations('common')
  const { renameExample, deleteExample } = useExampleStore()

  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(example.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const responseData: ResponseData = {
    status: example.status ?? 0,
    statusText: example.statusText ?? '',
    headers: (example.responseHeaders as Record<string, string>) ?? {},
    body: example.responseBody ?? '',
    durationMs: example.durationMs ?? 0,
    size: example.size ?? 0,
  }

  async function handleRename() {
    if (!nameDraft.trim() || nameDraft.trim() === example.name) {
      setRenaming(false)
      setNameDraft(example.name)
      return
    }
    setSaving(true)
    try {
      await renameExample(example.id, requestId, nameDraft.trim())
      setRenaming(false)
    } catch {
      setNameDraft(example.name)
      setRenaming(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t('confirmDelete'))) return
    setDeleting(true)
    try {
      await deleteExample(example.id, requestId)
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="flex w-full max-w-3xl flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl" style={{ height: '85vh' }}>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-th-border px-4 py-3">
          {renaming ? (
            <>
              <input
                autoFocus
                type="text"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename()
                  if (e.key === 'Escape') { setRenaming(false); setNameDraft(example.name) }
                }}
                className="flex-1 rounded-md border border-th-border bg-th-surface px-2 py-1 text-sm text-th-fg focus:border-th-accent focus:outline-none"
              />
              <button onClick={handleRename} disabled={saving} title={tc('confirm')}
                className="rounded-md p-1.5 text-green-400 transition-colors hover:bg-th-surface-hover">
                <Check size={14} />
              </button>
              <button onClick={() => { setRenaming(false); setNameDraft(example.name) }} title={tc('cancel')}
                className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg">
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 truncate text-sm font-semibold text-th-fg">{nameDraft}</span>
              <button onClick={() => setRenaming(true)} title={tc('rename')}
                className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg">
                <Pencil size={13} />
              </button>
              <button onClick={handleDelete} disabled={deleting} title={tc('delete')}
                className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-red-400">
                <Trash2 size={13} />
              </button>
              <button onClick={onClose}
                className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg">
                <X size={15} />
              </button>
            </>
          )}
        </div>

        {/* Body: request (top half) + response (bottom half) */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* REQUEST section */}
          <div className="flex shrink-0 flex-col" style={{ height: '42%' }}>
            <div className="border-b border-th-border bg-th-surface px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-th-fg-muted">Request</span>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <RequestPanel example={example} />
            </div>
          </div>

          {/* Divider */}
          <div className="shrink-0 border-b border-th-border" />

          {/* RESPONSE section */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-th-border bg-th-surface px-3 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-th-fg-muted">Response</span>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <ResponsePanel response={responseData} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
