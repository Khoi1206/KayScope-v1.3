'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus, Trash2 } from 'lucide-react'
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

  function addVariable() {
    setVariables(v => [...v, { key: '', value: '', enabled: true, secret: false }])
  }

  function removeVariable(i: number) {
    setVariables(v => v.filter((_, idx) => idx !== i))
  }

  function updateVariable(i: number, patch: Partial<WorkspaceVariable>) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="flex w-[640px] max-h-[80vh] flex-col rounded-lg border border-th-border bg-th-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-th-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-th-fg">{tg('title')}</h2>
            <p className="text-xs text-th-fg-muted">{tg('description')}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[20px_1fr_1fr_28px] gap-1.5 px-1 pb-1 text-xs text-th-fg-muted">
            <span />
            <span>Key</span>
            <span>Value</span>
            <span />
          </div>

          {variables.map((v, i) => (
            <div key={i} className="grid grid-cols-[20px_1fr_1fr_28px] items-center gap-1.5 px-1 py-0.5">
              <input
                type="checkbox"
                checked={v.enabled}
                onChange={e => updateVariable(i, { enabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-th-accent"
              />
              <input
                type="text"
                value={v.key}
                placeholder="Variable name"
                onChange={e => updateVariable(i, { key: e.target.value })}
                className="rounded border border-th-border bg-th-input px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
              />
              <input
                type="text"
                value={v.value}
                placeholder="Value"
                onChange={e => updateVariable(i, { value: e.target.value })}
                className="rounded border border-th-border bg-th-input px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
              />
              <button
                onClick={() => removeVariable(i)}
                title={tc('removeRow')}
                className="flex items-center justify-center rounded p-1 text-th-fg-muted hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <button
            onClick={addVariable}
            className="mt-2 flex items-center gap-1 px-1 text-xs text-th-fg-muted hover:text-th-fg"
          >
            <Plus size={12} />
            {tg('addVariable')}
          </button>

          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-th-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-th-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? tc('loading') : tc('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
