'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace.store'
import type { WorkspaceType } from '@/db/schema'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  mode: 'create' | 'edit'
  workspaceId?: string      // required for edit mode
  initialName?: string
  initialType?: WorkspaceType
  initialDescription?: string
  onClose: () => void
}

export default function WorkspaceModal({
  mode,
  workspaceId,
  initialName = '',
  initialType = 'personal',
  initialDescription = '',
  onClose,
}: Props) {
  const t = useTranslations('workspace')
  const { createWorkspace, renameWorkspace, deleteWorkspace, switchWorkspace, workspaces } = useWorkspaceStore()

  const [name, setName] = useState(initialName)
  const [type, setType] = useState<WorkspaceType>(initialType)
  const [description, setDescription] = useState(initialDescription)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        await createWorkspace(name.trim(), type, description.trim() || undefined)
      } else if (workspaceId) {
        await renameWorkspace(workspaceId, {
          name: name.trim(),
          type,
          description: description.trim() || undefined,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!workspaceId) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    setError(null)
    try {
      // Switch to another workspace before deleting
      const other = workspaces.find(w => w.id !== workspaceId)
      if (other) await switchWorkspace(other.id)
      await deleteWorkspace(workspaceId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-th-border bg-th-surface shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-th-border px-4 py-3">
          <h2 className="text-sm font-semibold text-th-fg">
            {mode === 'create' ? t('creating') : t('editing')}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-th-fg-muted">{t('name')}</label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              maxLength={100}
              required
              className="rounded border border-th-border bg-th-bg px-3 py-1.5 text-sm text-th-fg placeholder:text-th-fg-muted/50 outline-none focus:border-th-accent"
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-th-fg-muted">{t('typeLabel')}</label>
            <div className="flex gap-2">
              {(['personal', 'team'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setType(opt)}
                  className={`flex-1 rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                    type === opt
                      ? 'border-th-accent bg-th-accent/10 text-th-accent'
                      : 'border-th-border bg-th-bg text-th-fg-muted hover:border-th-accent/50 hover:text-th-fg'
                  }`}
                >
                  {t(opt)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-th-fg-muted">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              maxLength={500}
              rows={2}
              className="resize-none rounded border border-th-border bg-th-bg px-3 py-1.5 text-sm text-th-fg placeholder:text-th-fg-muted/50 outline-none focus:border-th-accent"
            />
          </div>

          {error && (
            <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded bg-th-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-th-accent/90 disabled:opacity-50"
            >
              {saving ? '…' : mode === 'create' ? t('create') : t('save')}
            </button>
          </div>
        </form>

        {/* Danger zone — edit only */}
        {mode === 'edit' && (
          <div className="border-t border-th-border px-4 py-3">
            {confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-400">
                  {t('deleteConfirm', { name: name || 'this workspace' })}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded border border-th-border px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {deleting ? '…' : t('delete')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
              >
                <Trash2 size={13} />
                {t('delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
