'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Save } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import VarHighlight from '@/components/VarHighlight'
import { interpolateWithStatus } from '@/core/interpolation/engine'
import { emptyScopes, mergeScopes } from '@/core/interpolation/scope'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

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

  const allVars: Record<string, string> = { ...environmentVariables, ...localScope }
  const showOverlay = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g.test(url)

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
          className="rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs font-bold text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
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
              'w-full rounded-md border bg-th-input px-3 py-1.5 font-mono text-sm placeholder:text-th-fg-subtle focus:outline-none focus:ring-1',
              hasUnresolved
                ? 'border-yellow-500/40 focus:ring-yellow-500/40'
                : 'border-th-border focus:border-th-accent focus:ring-th-accent/50'
            )}
            style={showOverlay ? { color: 'transparent', caretColor: '#94a3b8' } : undefined}
          />

          {/* Colored overlay */}
          {showOverlay && (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-md px-3 py-1.5"
              aria-hidden
            >
              <div
                className="flex h-full items-center whitespace-pre font-mono text-sm"
                style={{ transform: `translateX(${-scrollLeft}px)` }}
              >
                <VarHighlight
                  text={url}
                  allVars={allVars}
                  className="text-th-fg"
                  onVarHover={openHover}
                  onVarLeave={scheduleClose}
                />
              </div>
            </div>
          )}

          {/* Unresolved warning icon */}
          {hasUnresolved && !showOverlay && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-yellow-500" title="Some variables are unresolved">
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
            className="flex items-center gap-1.5 rounded-md border border-th-border px-3 py-1.5 text-xs font-medium text-th-fg-muted transition-colors hover:border-th-accent hover:text-th-fg disabled:cursor-not-allowed disabled:opacity-40"
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
            'flex items-center gap-2 rounded-md px-5 py-1.5 text-sm font-semibold text-white transition-opacity',
            'bg-th-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
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
          value={allVars[hovered.name]}
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
      style={{ position: 'fixed', top: anchor.bottom + 8, left: anchor.left, zIndex: 9999 }}
      className="w-60 rounded-lg border border-th-border bg-th-bg p-3 shadow-2xl"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p className="mb-1.5 font-mono text-xs font-semibold">
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
