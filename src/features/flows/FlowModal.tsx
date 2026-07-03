'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useFlowStore, type FlowItem } from '@/store/flow.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  flow: FlowItem | null
  onClose: () => void
}

export default function FlowModal({ flow, onClose }: Props) {
  const t = useTranslations('flows')
  useEscapeKey(onClose)
  const isEdit = !!flow
  const { createFlow, updateFlow } = useFlowStore()
  const [name, setName] = useState(flow?.name ?? '')
  const [description, setDescription] = useState(flow?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError(t('nameRequired')); return }
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateFlow(flow.id, { name: name.trim(), description: description.trim() || null })
      } else {
        await createFlow({ name: name.trim(), description: description.trim() || undefined })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">{isEdit ? t('editFlow') : t('createFlow')}</p>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-th-fg-muted">{t('name')} *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="rounded border border-th-border bg-th-input px-3 py-1.5 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-th-fg-muted">{t('description')}</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              className="rounded border border-th-border bg-th-input px-3 py-1.5 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-th-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-th-accent-hover disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
