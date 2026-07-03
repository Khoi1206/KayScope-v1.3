'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from './ui/cn'

export type VarScope = 'local' | 'environment' | 'collection' | 'global' | null
export type SaveScope = 'local' | 'collection' | 'environment' | 'global'

export const SCOPE_BADGE: Record<NonNullable<VarScope>, { label: string; cls: string }> = {
  local:       { label: 'L · local',       cls: 'bg-purple-500/20 text-purple-300' },
  environment: { label: 'E · environment', cls: 'bg-green-500/20 text-green-300' },
  collection:  { label: 'C · collection',  cls: 'bg-orange-500/20 text-orange-300' },
  global:      { label: 'G · global',      cls: 'bg-blue-500/20 text-blue-300' },
}

interface ScopeItem {
  key: SaveScope
  letter: string
  letterCls: string
  label: string
  sub?: string
  available: boolean
  disabledNote?: string
}

interface Props {
  name: string
  scope: VarScope
  value: string | undefined
  anchor: DOMRect
  hasCollection: boolean
  hasEnvironment: boolean
  collectionName?: string
  environmentName?: string
  onSet: (scope: SaveScope, value: string) => Promise<void>
  onMouseEnter: () => void
  onMouseLeave: () => void
  onNavigateToVariables?: () => void
}

export default function VarHoverPopover({
  name, scope, value, anchor, hasCollection, hasEnvironment, collectionName, environmentName,
  onSet, onMouseEnter, onMouseLeave, onNavigateToVariables,
}: Props) {
  const [draft, setDraft] = useState(value ?? '')
  const [selectedScope, setSelectedScope] = useState<SaveScope>(() => {
    if (scope === 'local') return 'local'
    if (scope === 'collection') return 'collection'
    if (scope === 'environment') return 'environment'
    if (scope === 'global') return 'global'
    return hasCollection ? 'collection' : 'local'
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30) }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [dropdownOpen])

  const SCOPE_ITEMS: ScopeItem[] = [
    { key: 'local',       letter: 'L', letterCls: 'bg-purple-500/20 text-purple-300', label: 'Local',                          sub: 'this tab only', available: true },
    { key: 'collection',  letter: 'C', letterCls: 'bg-orange-500/20 text-orange-300', label: collectionName ?? 'Collection',   available: hasCollection, disabledNote: 'No parent collection' },
    { key: 'environment', letter: 'E', letterCls: 'bg-green-500/20 text-green-300',   label: environmentName ?? 'Environment', available: hasEnvironment, disabledNote: 'No environment selected' },
    { key: 'global',      letter: 'G', letterCls: 'bg-blue-500/20 text-blue-300',     label: 'Global',                         available: true },
  ]

  const currentItem = SCOPE_ITEMS.find(s => s.key === selectedScope) ?? SCOPE_ITEMS[0]!

  async function handleSet() {
    setSaving(true)
    setSaveError(null)
    try {
      await onSet(selectedScope, draft)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const badge = scope ? SCOPE_BADGE[scope] : null

  return (
    <div
      style={{ position: 'fixed', top: anchor.bottom + 2, left: anchor.left, zIndex: 9999 }}
      className="w-72 rounded-xl border border-th-border bg-th-bg p-3 shadow-2xl"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header: var name + current scope badge */}
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 truncate font-mono text-xs font-semibold text-th-accent">{`{{${name}}}`}</p>
        {badge ? (
          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', badge.cls)}>{badge.label}</span>
        ) : (
          <span className="rounded-md bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">unset</span>
        )}
      </div>

      {/* Value input */}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSet() }}
        placeholder="Enter value"
        className="mb-2.5 w-full rounded border border-th-border bg-th-input px-2 py-1.5 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
      />

      {/* Add to [scope] dropdown + Variables in request link */}
      <div className="mb-2.5 flex items-center gap-2">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-md border border-th-border bg-th-surface px-2 py-1 text-xs transition-colors hover:border-th-accent"
          >
            <span className={cn('rounded px-1 py-0.5 text-[10px] font-bold leading-none', currentItem.letterCls)}>
              {currentItem.letter}
            </span>
            <span className="text-th-fg-muted">Add to</span>
            <span className="font-medium text-th-fg">{currentItem.label}</span>
            <span className="text-[10px] text-th-fg-muted">{dropdownOpen ? '∧' : '∨'}</span>
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-56 rounded-xl border border-th-border bg-th-bg py-1 shadow-xl">
              {SCOPE_ITEMS.map(item => (
                <button
                  key={item.key}
                  disabled={!item.available}
                  onClick={() => {
                    if (item.available) {
                      setSelectedScope(item.key)
                      setDropdownOpen(false)
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                    item.available
                      ? 'cursor-pointer text-th-fg hover:bg-th-surface-hover'
                      : 'cursor-not-allowed opacity-50'
                  )}
                >
                  <span className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    item.available ? item.letterCls : 'bg-th-surface text-th-fg-subtle'
                  )}>
                    {item.letter}
                  </span>
                  <span className="flex-1 truncate">
                    {item.available ? item.label : (item.disabledNote ?? item.label)}
                  </span>
                  {item.sub && item.available && (
                    <span className="shrink-0 text-[10px] text-th-fg-muted">{item.sub}</span>
                  )}
                  {selectedScope === item.key && item.available && (
                    <span className="shrink-0 text-[10px] text-th-accent">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {onNavigateToVariables && (
          <button
            onClick={onNavigateToVariables}
            className="ml-auto text-[11px] text-th-fg-muted transition-colors hover:text-th-accent"
          >
            Variables in request →
          </button>
        )}
      </div>

      {saveError && (
        <p className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-400">{saveError}</p>
      )}
      <button
        onClick={handleSet}
        disabled={saving}
        className="w-full rounded-md bg-th-accent py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Set'}
      </button>
    </div>
  )
}
