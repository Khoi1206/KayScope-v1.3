'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Save } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { interpolateWithStatus } from '@/core/interpolation/engine'
import { emptyScopes, mergeScopes } from '@/core/interpolation/scope'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
const VAR_RE = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g

interface Props {
  method: string
  url: string
  onMethodChange: (method: string) => void
  onUrlChange: (url: string) => void
  onSend: () => void
  sending: boolean
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  onSave?: () => void
  isDirty?: boolean
  saving?: boolean
  onSetLocalVar?: (name: string, value: string) => void
}

export default function UrlBar({
  method,
  url,
  onMethodChange,
  onUrlChange,
  onSend,
  sending,
  localScope = {},
  environmentVariables = {},
  onSave,
  isDirty = false,
  saving = false,
  onSetLocalVar,
}: Props) {
  const t = useTranslations('request')
  const inputRef = useRef<HTMLInputElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hovered, setHovered] = useState<{ name: string; rect: DOMRect } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

  const scopes = mergeScopes(emptyScopes(), { local: localScope, environment: environmentVariables })
  const { result: resolvedUrl, hasUnresolved } = interpolateWithStatus(url, scopes)

  let sendDisabled = sending
  if (hasUnresolved) {
    try { new URL(resolvedUrl) } catch { sendDisabled = true }
  }

  // Build resolved map for all vars in the URL
  const resolvedMap: Record<string, string | undefined> = {}
  for (const m of [...url.matchAll(new RegExp(VAR_RE.source, 'g'))]) {
    const name = m[1]!
    resolvedMap[name] = localScope[name] ?? environmentVariables[name]
  }

  // Overlay segments
  const segments: Array<{ type: 'text' | 'var'; content: string; name?: string }> = []
  {
    let last = 0
    for (const m of [...url.matchAll(new RegExp(VAR_RE.source, 'g'))]) {
      if (m.index! > last) segments.push({ type: 'text', content: url.slice(last, m.index) })
      segments.push({ type: 'var', content: m[0], name: m[1] })
      last = m.index! + m[0].length
    }
    if (last < url.length) segments.push({ type: 'text', content: url.slice(last) })
  }
  const showOverlay = segments.some(s => s.type === 'var')

  function openHover(name: string, rect: DOMRect) {
    clearTimeout(closeTimer.current)
    setHovered({ name, rect })
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setHovered(null), 180)
  }
  function cancelClose() {
    clearTimeout(closeTimer.current)
  }

  return (
    <div className="border-b border-th-border bg-th-surface">
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Method selector */}
        <select
          value={method}
          onChange={e => onMethodChange(e.target.value)}
          className="rounded border border-th-border bg-th-input px-2 py-1.5 text-xs font-semibold text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
        >
          {HTTP_METHODS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* URL input with overlay */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            onScroll={e => setScrollLeft((e.target as HTMLInputElement).scrollLeft)}
            placeholder="https://api.example.com/{{endpoint}}"
            className={cn(
              'w-full rounded border bg-th-input px-3 py-1.5 font-mono text-sm placeholder:text-th-fg-subtle focus:outline-none focus:ring-1',
              hasUnresolved
                ? 'border-yellow-500/50 focus:ring-yellow-500/50'
                : 'border-th-border focus:ring-th-accent'
            )}
            style={showOverlay ? { color: 'transparent', caretColor: '#94a3b8' } : undefined}
          />

          {/* Colored overlay */}
          {showOverlay && (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded px-3 py-1.5"
              aria-hidden
            >
              <div
                className="flex h-full items-center whitespace-pre font-mono text-sm"
                style={{ transform: `translateX(${-scrollLeft}px)` }}
              >
                {segments.map((seg, i) =>
                  seg.type === 'text' ? (
                    <span key={i} className="text-th-fg">{seg.content}</span>
                  ) : (
                    <span
                      key={i}
                      className={cn(
                        'cursor-pointer underline decoration-dotted underline-offset-2',
                        resolvedMap[seg.name!] !== undefined ? 'text-th-accent' : 'text-yellow-400'
                      )}
                      style={{ pointerEvents: 'auto' }}
                      onMouseEnter={e => openHover(seg.name!, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                      onMouseLeave={scheduleClose}
                    >
                      {seg.content}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* Unresolved warning icon */}
          {hasUnresolved && !showOverlay && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-yellow-500" title="Some variables are unresolved">
              ⚠
            </span>
          )}
        </div>

        {/* Save button */}
        {onSave && (
          <button
            onClick={onSave}
            disabled={!isDirty || saving}
            title={isDirty ? t('save') : t('saved')}
            className="flex items-center gap-1.5 rounded border border-th-border px-3 py-1.5 text-xs font-medium text-th-fg-muted hover:border-th-accent hover:text-th-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={13} />
            {saving ? t('saving') : t('save')}
          </button>
        )}

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={sendDisabled}
          className={cn(
            'flex items-center gap-2 rounded px-4 py-1.5 text-sm font-medium text-white transition-colors',
            'bg-th-accent hover:bg-th-accent-hover disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <Send size={14} />
          {sending ? t('sending') : t('send')}
        </button>
      </div>

      {/* Hover popover */}
      {hovered && (
        <VarHoverPopover
          name={hovered.name}
          value={resolvedMap[hovered.name]}
          anchor={hovered.rect}
          onSet={v => { onSetLocalVar?.(hovered.name, v); setHovered(null) }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  )
}

function VarHoverPopover({
  name, value, anchor, onSet, onMouseEnter, onMouseLeave,
}: {
  name: string
  value: string | undefined
  anchor: DOMRect
  onSet: (v: string) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30) }, [])
  useEffect(() => { setDraft(value ?? '') }, [value])

  return (
    <div
      style={{ position: 'fixed', top: anchor.bottom + 6, left: anchor.left, zIndex: 9999 }}
      className="w-56 rounded border border-th-border bg-th-bg p-3 shadow-xl"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p className="mb-1 font-mono text-xs font-semibold">
        <span className={value !== undefined ? 'text-th-accent' : 'text-yellow-400'}>
          {`{{${name}}}`}
        </span>
      </p>
      {value !== undefined
        ? <p className="mb-2 truncate text-xs text-th-fg-subtle">→ <span className="font-mono text-th-fg">{value}</span></p>
        : <p className="mb-2 text-xs italic text-yellow-500/70">unset</p>
      }
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSet(draft) }}
        placeholder={`Override for this tab`}
        className="mb-1.5 w-full rounded border border-th-border bg-th-input px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
      />
      <p className="mb-2 text-xs text-th-fg-subtle">Local override — this tab only</p>
      <div className="flex justify-end">
        <button
          onClick={() => onSet(draft)}
          className="rounded bg-th-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90"
        >
          Set
        </button>
      </div>
    </div>
  )
}
