'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from './ui/cn'

export interface KVRow {
  key: string
  value: string
  enabled: boolean
  description?: string
}

interface Props {
  rows: KVRow[]
  onChange: (rows: KVRow[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  showDescription?: boolean
  disabled?: boolean
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  onSetLocalVar?: (name: string, value: string) => void
}

const VAR_RE = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g

function extractVars(s: string): string[] {
  return [...new Set([...s.matchAll(new RegExp(VAR_RE.source, 'g'))].map(m => m[1]!))]
}

function interpolatePreview(s: string, map: Record<string, string | undefined>): string {
  return s.replace(new RegExp(VAR_RE.source, 'g'), (_, name) => map[name] ?? `{{${name}}}`)
}

export default function KVEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  showDescription = false,
  disabled = false,
  localScope,
  environmentVariables,
  onSetLocalVar,
}: Props) {
  const t = useTranslations('kvEditor')
  const scopeEnabled = localScope !== undefined || environmentVariables !== undefined

  function addRow() {
    onChange([...rows, { key: '', value: '', enabled: true }])
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }
  function updateRow(i: number, patch: Partial<KVRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <div className="flex flex-col gap-0">
      <div className={cn(
        'grid gap-2 px-2 py-1 text-xs font-medium text-th-fg-muted',
        showDescription ? 'grid-cols-[20px_1fr_1fr_1fr_28px]' : 'grid-cols-[20px_1fr_1fr_28px]'
      )}>
        <span /><span>{t('key')}</span><span>{t('value')}</span>
        {showDescription && <span>{t('description')}</span>}
        <span />
      </div>

      {rows.map((row, i) => (
        <div key={i} className={cn(
          'grid items-start gap-2 px-2 py-0.5',
          showDescription ? 'grid-cols-[20px_1fr_1fr_1fr_28px]' : 'grid-cols-[20px_1fr_1fr_28px]'
        )}>
          <input
            type="checkbox"
            checked={row.enabled}
            disabled={disabled}
            onChange={e => updateRow(i, { enabled: e.target.checked })}
            className="mt-1.5 h-3.5 w-3.5 accent-th-accent"
          />
          <VarAwareInput
            value={row.key}
            placeholder={keyPlaceholder}
            disabled={disabled}
            onChange={v => updateRow(i, { key: v })}
            localScope={scopeEnabled ? localScope : undefined}
            environmentVariables={scopeEnabled ? environmentVariables : undefined}
            onSetLocalVar={onSetLocalVar}
          />
          <VarAwareInput
            value={row.value}
            placeholder={valuePlaceholder}
            disabled={disabled}
            onChange={v => updateRow(i, { value: v })}
            localScope={scopeEnabled ? localScope : undefined}
            environmentVariables={scopeEnabled ? environmentVariables : undefined}
            onSetLocalVar={onSetLocalVar}
          />
          {showDescription && (
            <input
              type="text"
              value={row.description ?? ''}
              placeholder={t('description')}
              disabled={disabled}
              onChange={e => updateRow(i, { description: e.target.value })}
              className="w-full rounded border border-th-border bg-th-input px-2 py-1 text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
            />
          )}
          <button
            onClick={() => removeRow(i)}
            disabled={disabled}
            className="mt-0.5 flex items-center justify-center rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-error disabled:opacity-30"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <div className="px-2 pt-1">
        <button
          onClick={addRow}
          disabled={disabled}
          className="flex items-center gap-1 text-xs text-th-fg-muted hover:text-th-fg disabled:opacity-30"
        >
          <Plus size={12} />
          {t('addRow')}
        </button>
      </div>
    </div>
  )
}

// ── VarAwareInput ──────────────────────────────────────────────────────────

interface VarAwareInputProps {
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (v: string) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  onSetLocalVar?: (name: string, value: string) => void
}

function VarAwareInput({
  value,
  placeholder,
  disabled,
  onChange,
  localScope,
  environmentVariables,
  onSetLocalVar,
}: VarAwareInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hovered, setHovered] = useState<{ name: string; rect: DOMRect } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

  const scopeEnabled = localScope !== undefined || environmentVariables !== undefined
  const varNames = extractVars(value)
  const hasVars = varNames.length > 0

  // resolved map for all vars in this field
  const resolvedMap: Record<string, string | undefined> = {}
  for (const name of varNames) {
    resolvedMap[name] = localScope?.[name] ?? environmentVariables?.[name]
  }

  // preview: full interpolated string, only shown if something actually changed
  const preview = scopeEnabled && hasVars ? interpolatePreview(value, resolvedMap) : null
  const showPreview = preview !== null && preview !== value

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

  // Build overlay segments
  const segments: Array<{ type: 'text' | 'var'; content: string; name?: string }> = []
  if (scopeEnabled && hasVars) {
    let last = 0
    for (const m of [...value.matchAll(new RegExp(VAR_RE.source, 'g'))]) {
      if (m.index! > last) segments.push({ type: 'text', content: value.slice(last, m.index) })
      segments.push({ type: 'var', content: m[0], name: m[1] })
      last = m.index! + m[0].length
    }
    if (last < value.length) segments.push({ type: 'text', content: value.slice(last) })
  }

  const showOverlay = scopeEnabled && segments.length > 0

  return (
    <div className="w-full">
      {/* Input + overlay wrapper */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          onScroll={e => setScrollLeft((e.target as HTMLInputElement).scrollLeft)}
          className="w-full rounded border border-th-border bg-th-input px-2 py-1 font-mono text-xs placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent disabled:opacity-50"
          style={showOverlay ? { color: 'transparent', caretColor: '#94a3b8' } : undefined}
        />

        {showOverlay && (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded px-2 py-1"
            aria-hidden
          >
            <div
              className="flex h-full items-center whitespace-pre font-mono text-xs"
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
      </div>

      {/* Resolved preview */}
      {showPreview && (
        <div className="mt-0.5 truncate pl-2 font-mono text-xs italic text-th-fg-subtle">
          → {preview}
        </div>
      )}

      {/* Hover popover (fixed so it's never clipped by table) */}
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

// ── VarHoverPopover ────────────────────────────────────────────────────────

function VarHoverPopover({
  name,
  value,
  anchor,
  onSet,
  onMouseEnter,
  onMouseLeave,
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

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  // Keep draft in sync when value changes from outside (e.g. env switch)
  useEffect(() => { setDraft(value ?? '') }, [value])

  return (
    <div
      style={{ position: 'fixed', top: anchor.bottom + 6, left: anchor.left, zIndex: 9999 }}
      className="w-56 rounded border border-th-border bg-th-bg p-3 shadow-xl"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Variable name */}
      <p className="mb-1 font-mono text-xs font-semibold">
        <span className={value !== undefined ? 'text-th-accent' : 'text-yellow-400'}>
          {`{{${name}}}`}
        </span>
      </p>

      {/* Current resolved value */}
      {value !== undefined && (
        <p className="mb-2 truncate text-xs text-th-fg-subtle">
          → <span className="font-mono text-th-fg">{value}</span>
        </p>
      )}
      {value === undefined && (
        <p className="mb-2 text-xs italic text-yellow-500/70">unset</p>
      )}

      {/* Quick-set input */}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSet(draft) }}
        placeholder={`Override value for this tab`}
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
