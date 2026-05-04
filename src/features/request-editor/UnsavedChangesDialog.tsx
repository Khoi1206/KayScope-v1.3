'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Props {
  tabTitle: string
  saving: boolean
  saveError: string | null
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

export default function UnsavedChangesDialog({ tabTitle, saving, saveError, onCancel, onDiscard, onSave }: Props) {
  const t = useTranslations('request')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
        <div className="flex items-center gap-2 border-b border-th-border px-5 py-3">
          <AlertTriangle size={14} className="shrink-0 text-amber-400" />
          <p className="text-sm font-semibold">{t('unsavedDialog.title')}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-th-fg-muted">
            {t('unsavedDialog.message', { name: tabTitle })}
          </p>
          {saveError && (
            <p className="mt-2 text-xs text-red-400">{saveError}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            {t('unsavedDialog.cancel')}
          </button>
          <button
            onClick={onDiscard}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            {t('unsavedDialog.discard')}
          </button>
          <button
            disabled={saving}
            onClick={onSave}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t('saving') : t('unsavedDialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
