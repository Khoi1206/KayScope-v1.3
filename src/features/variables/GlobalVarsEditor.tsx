'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus, Trash2, Lock, LockOpen } from 'lucide-react'
import { useWorkspaceStore, type WorkspaceVariable } from '@/store/workspace.store'

interface Props {
  onClose: () => void
}

export default function GlobalVarsEditor({ onClose }: Props) {
  const tc = useTranslations('common')
  const tg = useTranslations('globals')
  const { workspace, updateGlobalVariables } = useWorkspaceStore()
  const [variables, setVariables] = useState<WorkspaceVariable[]>(
    workspace?.globalVariables ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasEdited = useRef(false)

  // Sync local state when workspace loads (handles the case where workspace
  // was null at mount time and loads asynchronously)
  useEffect(() => {
    if (!hasEdited.current && workspace?.globalVariables) {
      setVariables(workspace.globalVariables)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.globalVariables])

  function addVariable() {
    hasEdited.current = true
    setVariables(v => [...v, { key: '', value: '', enabled: true, secret: false }])
  }

  function removeVariable(i: number) {
    hasEdited.current = true
    setVariables(v => v.filter((_, idx) => idx !== i))
  }

  function updateVariable(i: number, patch: Partial<WorkspaceVariable>) {
    hasEdited.current = true
    setVariables(v => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await updateGlobalVariables(variables)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="flex w-[640px] max-h-[80vh] flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-th-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-th-fg">{tg('title')}</h2>
            <p className="mt-0.5 text-xs text-th-fg-subtle">{tg('description')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {variables.length > 0 && (
            <div className="rounded-md border border-th-border overflow-hidden">
              <div className="grid grid-cols-[32px_1fr_1fr_56px_32px] gap-0 border-b border-th-border bg-th-surface px-2 py-1.5 text-[11px] font-medium text-th-fg-muted">
                <span />
                <span className="px-2">Key</span>
                <span className="px-2">Value</span>
                <span className="text-center">Secret</span>
                <span />
              </div>
              {variables.map((v, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[32px_1fr_1fr_56px_32px] items-center gap-0 px-2 py-1 transition-colors ${
                    !v.enabled ? 'opacity-40' : ''
                  } ${i > 0 ? 'border-t border-th-border/50' : ''} hover:bg-th-surface/50`}
                >
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={v.enabled}
                      onChange={e => updateVariable(i, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 accent-th-accent"
                    />
                  </div>
                  <input
                    type="text"
                    value={v.key}
                    placeholder="Variable name"
                    onChange={e => updateVariable(i, { key: e.target.value })}
                    className="mx-1 rounded-sm border-0 bg-transparent px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50"
                  />
                  <div className="relative mx-1">
                    <input
                      type={v.secret ? 'password' : 'text'}
                      value={v.value}
                      placeholder="Value"
                      onChange={e => updateVariable(i, { value: e.target.value })}
                      className="w-full rounded-sm border-0 bg-transparent px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => updateVariable(i, { secret: !v.secret })}
                      title={tc('toggleSecret')}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                        v.secret
                          ? 'bg-th-accent/15 text-th-accent hover:bg-th-accent/25'
                          : 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
                      }`}
                    >
                      {v.secret ? <Lock size={10} /> : <LockOpen size={10} />}
                      {v.secret ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => removeVariable(i)}
                      title={tc('removeRow')}
                      className="rounded p-1 text-th-fg-muted transition-colors hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={addVariable}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <Plus size={12} />
            {tg('addVariable')}
          </button>

          {error && (
            <div className="mx-5 mb-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-xs font-medium text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-th-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? tc('loading') : tc('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
