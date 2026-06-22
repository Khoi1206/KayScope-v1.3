'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2, Paperclip, X, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from './ui/cn'
import VarHoverPopover, { type SaveScope, type VarScope } from './VarHoverPopover'

export interface KVRow {
  key: string
  value: string
  enabled: boolean
  description?: string
  type?: 'text' | 'file'
  fileName?: string
  fileMimeType?: string
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
  showFileType?: boolean
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

// ── FileCell ──────────────────────────────────────────────────────────────────

interface FileCellProps {
  uploadId: string   // row.value when file is uploaded, else ''
  fileName?: string
  disabled?: boolean
  onUploaded: (uploadId: string, fileName: string, fileMimeType: string) => void
  onClear: () => void
}

function FileCell({ uploadId, fileName, disabled, onUploaded, onClear }: FileCellProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads/temp', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Upload failed (${res.status})`)
      }
      const data = await res.json() as { uploadId: string; fileName: string; mimeType: string }
      onUploaded(data.uploadId, data.fileName, data.mimeType)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleClear() {
    if (uploadId) {
      // Best-effort cleanup — don't block UI on failure
      fetch(`/api/uploads/temp?uploadId=${encodeURIComponent(uploadId)}`, { method: 'DELETE' }).catch(() => {})
    }
    onClear()
    setError(null)
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-th-fg-muted">
        <Loader2 size={11} className="animate-spin" />
        <span>Uploading…</span>
      </div>
    )
  }

  if (uploadId && fileName) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <Paperclip size={11} className="shrink-0 text-th-accent" />
        <span
          className="min-w-0 flex-1 cursor-pointer truncate text-xs text-th-fg underline decoration-dotted"
          title={fileName}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          {fileName}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded p-0.5 text-th-fg-muted hover:text-red-400"
            title="Remove file"
          >
            <X size={10} />
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} disabled={disabled} />
      </div>
    )
  }

  return (
    <div className="px-2 py-1">
      <label className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded border border-dashed border-th-border px-2 py-0.5 text-xs text-th-fg-muted transition-colors hover:border-th-accent hover:text-th-fg',
        disabled && 'cursor-not-allowed opacity-50'
      )}>
        <Paperclip size={11} />
        <span>Choose file</span>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} disabled={disabled} />
      </label>
      {error && <p className="mt-0.5 px-1 text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

// ── KVEditor ──────────────────────────────────────────────────────────────────

export default function KVEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  showDescription = false,
  showFileType = false,
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
    const row = rows[i]
    // Best-effort cleanup of temp file when removing a file row
    if (row?.type === 'file' && row.value) {
      fetch(`/api/uploads/temp?uploadId=${encodeURIComponent(row.value)}`, { method: 'DELETE' }).catch(() => {})
    }
    onChange(rows.filter((_, idx) => idx !== i))
  }
  function updateRow(i: number, patch: Partial<KVRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function handleTypeChange(i: number, newType: 'text' | 'file') {
    const row = rows[i]
    if (!row) return
    if (newType === 'text' && row.type === 'file' && row.value) {
      // Delete the temp upload when switching back to text
      fetch(`/api/uploads/temp?uploadId=${encodeURIComponent(row.value)}`, { method: 'DELETE' }).catch(() => {})
    }
    updateRow(i, { type: newType, value: '', fileName: undefined, fileMimeType: undefined })
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

  // Grid columns: [checkbox] [key] [value] [description?] [delete]
  const gridCols = showDescription ? 'grid-cols-[32px_1fr_1fr_1fr_32px]' : 'grid-cols-[32px_1fr_1fr_32px]'

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 && (
        <div className="rounded-md border border-th-border overflow-hidden">
          {/* Header */}
          <div className={cn(
            'grid gap-0 border-b border-th-border bg-th-surface px-2 py-1.5 text-[11px] font-medium text-th-fg-muted',
            gridCols
          )}>
            <span /><span className="px-2">{t('key')}</span><span className="px-2">{t('value')}</span>
            {showDescription && <span className="px-2">{t('description')}</span>}
            <span />
          </div>

          {rows.map((row, i) => {
            const isFile = showFileType && row.type === 'file'
            return (
              <div key={i} className={cn(
                'group grid items-start gap-0 px-2 py-1 transition-colors hover:bg-th-surface/50',
                i > 0 ? 'border-t border-th-border/50' : '',
                !row.enabled ? 'opacity-40' : '',
                gridCols
              )}>
                {/* Checkbox */}
                <div className="flex justify-center pt-1.5">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    disabled={disabled}
                    onChange={e => updateRow(i, { enabled: e.target.checked })}
                    className="h-3.5 w-3.5 accent-th-accent"
                  />
                </div>

                {/* Key cell — includes inline Text/File selector when showFileType */}
                <div className={cn('flex items-center gap-1', showFileType && 'pr-1')}>
                  <div className="min-w-0 flex-1">
                    <VarAwareInput
                      value={row.key}
                      placeholder={keyPlaceholder}
                      disabled={disabled}
                      onChange={v => updateRow(i, { key: v })}
                      {...inputProps}
                    />
                  </div>
                  {showFileType && (
                    <select
                      value={row.type ?? 'text'}
                      disabled={disabled}
                      onChange={e => handleTypeChange(i, e.target.value as 'text' | 'file')}
                      className="shrink-0 rounded border border-th-border bg-th-input px-1 py-0.5 text-[10px] text-th-fg-muted focus:border-th-accent focus:outline-none"
                    >
                      <option value="text">Text</option>
                      <option value="file">File</option>
                    </select>
                  )}
                </div>

                {/* Value cell — text input OR file picker */}
                {isFile ? (
                  <FileCell
                    uploadId={row.value}
                    fileName={row.fileName}
                    disabled={disabled}
                    onUploaded={(uploadId, fileName, fileMimeType) =>
                      updateRow(i, { value: uploadId, fileName, fileMimeType })
                    }
                    onClear={() => updateRow(i, { value: '', fileName: undefined, fileMimeType: undefined })}
                  />
                ) : (
                  <VarAwareInput
                    value={row.value}
                    placeholder={valuePlaceholder}
                    disabled={disabled}
                    onChange={v => updateRow(i, { value: v })}
                    {...inputProps}
                  />
                )}

                {showDescription && (
                  <input
                    type="text"
                    value={row.description ?? ''}
                    placeholder={t('description')}
                    disabled={disabled}
                    onChange={e => updateRow(i, { description: e.target.value })}
                    className="mx-1 rounded-sm border-0 bg-transparent px-2 py-1 text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50"
                  />
                )}

                <div className="flex justify-center pt-0.5">
                  <button
                    onClick={() => removeRow(i)}
                    disabled={disabled}
                    className="rounded p-1 text-th-fg-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-30"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <button
          onClick={addRow}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg disabled:opacity-30"
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
          className="w-full rounded-sm border-0 bg-transparent px-2 py-1 font-mono text-xs placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50 disabled:opacity-50"
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
