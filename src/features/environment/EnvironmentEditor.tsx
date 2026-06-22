'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus, Trash2, Lock, LockOpen, Eye, EyeOff } from 'lucide-react'
import { useEnvironmentStore, type EnvironmentItem, type EnvironmentVariable } from '@/store/environment.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  env: EnvironmentItem | null
  onClose: () => void
}

export default function EnvironmentEditor({ env, onClose }: Props) {
  useEscapeKey(onClose)
  const t = useTranslations('env')
  const tc = useTranslations('common')
  const { createEnvironment, updateEnvironment } = useEnvironmentStore()
  const [name, setName] = useState(env?.name ?? '')
  const [variables, setVariables] = useState<EnvironmentVariable[]>(env?.variables ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  function toggleReveal(i: number) {
    setRevealed(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const isEdit = env !== null

  function addVariable() {
    setVariables(v => [...v, { key: '', value: '', enabled: true }])
  }

  function removeVariable(i: number) {
    setVariables(v => v.filter((_, idx) => idx !== i))
  }

  function updateVariable(i: number, patch: Partial<EnvironmentVariable>) {
    setVariables(v => v.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateEnvironment(env.id, { name: name.trim(), variables })
      } else {
        await createEnvironment(name.trim(), variables)
      }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="flex w-[680px] max-h-[85vh] flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-th-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-th-fg">
              {isEdit ? t('editTitle') : t('createTitle')}
            </h2>
            {isEdit && (
              <p className="mt-0.5 text-xs text-th-fg-muted">{env.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Name field */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-th-fg-muted">{tc('name')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent/50 focus:border-th-accent"
              autoFocus
            />
          </div>

          {/* Variables table */}
          <div>
            <p className="mb-2 text-xs font-medium text-th-fg-muted">{t('variables')}</p>

            {variables.length > 0 && (
              <div className="rounded-md border border-th-border overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[32px_1fr_1fr_56px_32px] gap-0 border-b border-th-border bg-th-surface px-2 py-1.5 text-[11px] font-medium text-th-fg-muted">
                  <span />
                  <span className="px-2">Key</span>
                  <span className="px-2">Value</span>
                  <span className="text-center">Secret</span>
                  <span />
                </div>

                {/* Rows */}
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
                      placeholder={t('keyPlaceholder')}
                      onChange={e => updateVariable(i, { key: e.target.value })}
                      className="mx-1 rounded-sm border-0 bg-transparent px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50"
                    />
                    <div className="relative mx-1">
                      <input
                        type={v.secret && !revealed.has(i) ? 'password' : 'text'}
                        value={v.value}
                        placeholder={t('valuePlaceholder')}
                        onChange={e => updateVariable(i, { value: e.target.value })}
                        className="w-full rounded-sm border-0 bg-transparent px-2 py-1 font-mono text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:bg-th-input focus:ring-1 focus:ring-th-accent/50"
                        style={v.secret && !revealed.has(i) ? { paddingRight: '1.5rem' } : undefined}
                      />
                      {v.secret && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(i)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-th-fg-muted hover:text-th-fg"
                          tabIndex={-1}
                        >
                          {revealed.has(i) ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      )}
                    </div>

                    {/* Secret toggle */}
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => updateVariable(i, { secret: !v.secret })}
                        title={v.secret ? 'Remove secret' : 'Mark as secret'}
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
              className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
            >
              <Plus size={12} />
              {t('addVariable')}
            </button>
          </div>

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="rounded-md bg-th-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? tc('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
