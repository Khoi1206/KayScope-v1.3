'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from './ui/cn'
import VarHoverPopover, { type SaveScope, type VarScope } from './VarHoverPopover'

export interface KVRow {
  key: string
  value: string
  enabled: boolean
  description?: string
}

export interface VarAwareInputProps {
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (v: string) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  collectionVariables?: Record<string, string>
  globalVariables?: Record<string, string>
  hasCollection?: boolean
  hasEnvironment?: boolean
  collectionName?: string
  environmentName?: string
  onSaveVar?: (scope: SaveScope, name: string, value: string) => Promise<void>
  onNavigateToVariables?: () => void
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
  collectionVariables?: Record<string, string>
  globalVariables?: Record<string, string>
  hasCollection?: boolean
  hasEnvironment?: boolean
  collectionName?: string
  environmentName?: string
  onSaveVar?: (scope: SaveScope, name: string, value: string) => Promise<void>
  onNavigateToVariables?: () => void
}

const VAR_RE = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g

function extractVars(s: string): string[] {
  return [...new Set([...s.matchAll(new RegExp(VAR_RE.source, 'g'))].map(m => m[1]!))]
}

function interpolatePreview(s: string, map: Record<string, string | undefined>): string {
  return s.replace(new RegExp(VAR_RE.source, 'g'), (_, name) => map[name] ?? `{{${name}}}`)
}

function detectScope(
  name: string,
  local: Record<string, string> = {},
  env: Record<string, string> = {},
  col: Record<string, string> = {},
  global: Record<string, string> = {},
): VarScope {
  if (name in local) return 'local'
  if (name in env) return 'environment'
  if (name in col) return 'collection'
  if (name in global) return 'global'
  return null
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
  collectionVariables,
  globalVariables,
  hasCollection,
  hasEnvironment,
  collectionName,
  environmentName,
  onSaveVar,
  onNavigateToVariables,
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

  const inputProps = scopeEnabled ? {
    localScope,
    environmentVariables,
    collectionVariables,
    globalVariables,
    hasCollection,
    hasEnvironment,
    collectionName,
    environmentName,
    onSaveVar,
    onNavigateToVariables,
  } : {}

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className={cn(
        'grid gap-2 border-b border-th-border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-th-fg-subtle',
        showDescription ? 'grid-cols-[20px_1fr_1fr_1fr_28px]' : 'grid-cols-[20px_1fr_1fr_28px]'
      )}>
        <span /><span>{t('key')}</span><span>{t('value')}</span>
        {showDescription && <span>{t('description')}</span>}
        <span />
      </div>

      {rows.map((row, i) => (
        <div key={i} className={cn(
          'group grid items-start gap-2 border-b border-th-border/50 px-2 py-0.5 transition-colors hover:bg-th-surface-hover/40',
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
            {...inputProps}
          />
          <VarAwareInput
            value={row.value}
            placeholder={valuePlaceholder}
            disabled={disabled}
            onChange={v => updateRow(i, { value: v })}
            {...inputProps}
          />
          {showDescription && (
            <input
              type="text"
              value={row.description ?? ''}
              placeholder={t('description')}
              disabled={disabled}
              onChange={e => updateRow(i, { description: e.target.value })}
              className="w-full rounded-md border border-th-border bg-th-input px-2 py-1 text-xs text-th-fg placeholder:text-th-fg-subtle focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            />
          )}
          <button
            onClick={() => removeRow(i)}
            disabled={disabled}
            className="mt-0.5 flex items-center justify-center rounded-md p-1 text-th-fg-subtle opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-30"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

      <div className="px-2 py-2">
        <button
          onClick={addRow}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs text-th-fg-subtle transition-colors hover:text-th-fg disabled:opacity-30"
        >
          <Plus size={12} />
          {t('addRow')}
        </button>
      </div>
    </div>
  )
}

// ── VarAwareInput ──────────────────────────────────────────────────────────

export function VarAwareInput({
  value,
  placeholder,
  disabled,
  onChange,
  localScope = {},
  environmentVariables = {},
  collectionVariables = {},
  globalVariables = {},
  hasCollection = false,
  hasEnvironment = false,
  collectionName,
  environmentName,
  onSaveVar,
  onNavigateToVariables,
}: VarAwareInputProps) {
  const [scrollLeft, setScrollLeft] = useState(0)
  const [hovered, setHovered] = useState<{ name: string; rect: DOMRect } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
  const savingRef = useRef(false)

  const scopeEnabled = Object.keys(localScope).length > 0
    || Object.keys(environmentVariables).length > 0
    || Object.keys(collectionVariables).length > 0
    || Object.keys(globalVariables).length > 0
    || onSaveVar !== undefined

  const varNames = extractVars(value)
  const hasVars = varNames.length > 0

  // Merged resolution map (higher priority first — later overwrites lower)
  const allVars: Record<string, string> = {
    ...globalVariables, ...collectionVariables, ...environmentVariables, ...localScope,
  }

  const resolvedMap: Record<string, string | undefined> = {}
  for (const name of varNames) {
    resolvedMap[name] = allVars[name]
  }

  const preview = hasVars ? interpolatePreview(value, resolvedMap) : null
  const showPreview = preview !== null && preview !== value

  function openHover(name: string, rect: DOMRect) {
    clearTimeout(closeTimer.current)
    setHovered({ name, rect })
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => { if (!savingRef.current) setHovered(null) }, 400)
  }
  function cancelClose() { clearTimeout(closeTimer.current) }

  // Build overlay segments
  const segments: Array<{ type: 'text' | 'var'; content: string; name?: string }> = []
  if (hasVars) {
    let last = 0
    for (const m of [...value.matchAll(new RegExp(VAR_RE.source, 'g'))]) {
      if (m.index! > last) segments.push({ type: 'text', content: value.slice(last, m.index) })
      segments.push({ type: 'var', content: m[0], name: m[1] })
      last = m.index! + m[0].length
    }
    if (last < value.length) segments.push({ type: 'text', content: value.slice(last) })
  }

  const showOverlay = segments.length > 0

  return (
    <div className="w-full">
      {/* Input + overlay wrapper */}
      <div className="relative">
        <input
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

      {/* Hover popover */}
      {hovered && onSaveVar && (
        <VarHoverPopover
          name={hovered.name}
          scope={detectScope(hovered.name, localScope, environmentVariables, collectionVariables, globalVariables)}
          value={resolvedMap[hovered.name]}
          anchor={hovered.rect}
          hasCollection={hasCollection}
          hasEnvironment={hasEnvironment}
          collectionName={collectionName}
          environmentName={environmentName}
          onNavigateToVariables={onNavigateToVariables}
          onSet={async (scope, val) => {
            savingRef.current = true
            clearTimeout(closeTimer.current)
            try {
              await onSaveVar(scope, hovered.name, val)
              setHovered(null)
            } finally {
              savingRef.current = false
            }
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  )
}
