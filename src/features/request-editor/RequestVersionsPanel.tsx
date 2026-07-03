'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Save, RotateCcw, Trash2 } from 'lucide-react'
import { useRequestStore, type TabSnapshot } from '@/store/request.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import InputModal from '@/components/InputModal'
import ConfirmModal from '@/components/ConfirmModal'

interface Props {
  requestId: string
  snapshot: TabSnapshot
  onRestore: (versionId: string) => Promise<void>
  onClose: () => void
}

export default function RequestVersionsPanel({ requestId, snapshot, onRestore, onClose }: Props) {
  const t = useTranslations('request')
  const { versions, fetchVersions, saveVersion, deleteVersion } = useRequestStore()
  const list = versions[requestId] ?? []

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEscapeKey(onClose)
  useEffect(() => { void fetchVersions(requestId) }, [requestId, fetchVersions])

  async function handleSave(label: string) {
    setSaving(true)
    try {
      await saveVersion(requestId, label || undefined, snapshot)
      setShowSaveModal(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmRestore() {
    if (!confirmRestoreId) return
    setRestoringId(confirmRestoreId)
    try {
      await onRestore(confirmRestoreId)
    } finally {
      setRestoringId(null)
      setConfirmRestoreId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return
    setDeletingId(confirmDeleteId)
    try {
      await deleteVersion(requestId, confirmDeleteId)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="flex h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
            <p className="text-sm font-semibold text-th-fg">{t('versions.title')}</p>
            <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
              <X size={15} />
            </button>
          </div>

          <div className="shrink-0 border-b border-th-border px-5 py-3">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1.5 rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-th-accent-hover"
            >
              <Save size={13} />
              {t('versions.saveCurrent')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {list.length === 0 ? (
              <p className="text-xs text-th-fg-subtle">
                {t('versions.empty')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map(v => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-md border border-th-border bg-th-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-th-fg">
                        {v.label || new Date(v.createdAt).toLocaleString()}
                      </p>
                      <p className="truncate text-[11px] text-th-fg-subtle">
                        {v.label && `${new Date(v.createdAt).toLocaleString()} · `}
                        {t('versions.summary', { method: v.method, url: v.url })}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmRestoreId(v.id)}
                      disabled={restoringId === v.id}
                      className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs text-th-accent hover:bg-th-surface-hover disabled:opacity-50"
                    >
                      <RotateCcw size={12} />
                      {restoringId === v.id ? t('versions.restoring') : t('versions.restore')}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(v.id)}
                      disabled={deletingId === v.id}
                      title={t('versions.deleteHint')}
                      className="flex shrink-0 items-center rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <InputModal
          title={t('versions.saveModalTitle')}
          label={t('versions.saveModalLabel')}
          placeholder={t('versions.saveModalPlaceholder')}
          initialValue={new Date().toLocaleString()}
          confirmLabel={saving ? t('versions.saveModalSaving') : t('versions.saveModalConfirm')}
          onConfirm={handleSave}
          onCancel={() => setShowSaveModal(false)}
        />
      )}

      {confirmRestoreId && (
        <ConfirmModal
          title={t('versions.restoreConfirmTitle')}
          message={t('versions.restoreConfirmMessage')}
          confirmLabel={t('versions.restoreConfirmLabel')}
          danger={false}
          onConfirm={handleConfirmRestore}
          onCancel={() => setConfirmRestoreId(null)}
        />
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title={t('versions.deleteConfirmTitle')}
          message={t('versions.deleteConfirmMessage')}
          confirmLabel={t('versions.deleteConfirmLabel')}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </>
  )
}
