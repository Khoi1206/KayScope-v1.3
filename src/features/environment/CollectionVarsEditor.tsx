'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus, Trash2 } from 'lucide-react'
import { useCollectionStore, type CollectionItem } from '@/store/collection.store'

interface Variable {
  key: string
  value: string
  enabled: boolean
}

interface Props {
  collection: CollectionItem
  onClose: () => void
}

export default function CollectionVarsEditor({ collection, onClose }: Props) {
  const tc = useTranslations('common')
  const [variables, setVariables] = useState<Variable[]>(collection.variables ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { updateCollection } = useCollectionStore()

  function addVariable() {
    setVariables(v => [...v, { key: '', value: '', enabled: true }])
  }

  function removeVariable(i: number) {
    setVariables(v => v.filter((_, idx) => idx !== i))
  }

  function updateVariable(i: number, patch: Partial<Variable>) {
    setVariables(v => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await updateCollection(collection.id, { variables })
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
      <div className="flex w-[600px] max-h-[80vh] flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-th-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-th-fg">Collection Variables</h2>
            <p className="mt-0.5 max-w-xs truncate text-xs text-th-fg-subtle">{collection.name}</p>
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
              <div className="grid grid-cols-[32px_1fr_1fr_32px] gap-0 border-b border-th-border bg-th-surface px-2 py-1.5 text-[11px] font-medium text-th-fg-muted">
                <span />
                <span className="px-2">Key</span>
                <span className="px-2">Value</span>
                <span />
              </div>
              {variables.map((v, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[32px_1fr_1fr_32px] items-center gap-0 px-2 py-1 transition-colors ${
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
                  <input
                    type="text"
                    value={v.value}
                    placeholder="Value"
                    onChange={e => updateVariable(i, { value: e.target.value })}
                    className="mx-1 rounded-sm border-0 bg-transparent px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50"
                  />
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
            Add variable
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
