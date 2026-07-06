'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  user: { name: string; email: string }
  onConfirm: () => void
  onCancel: () => void
}

export default function AdminDeleteUserModal({ user, onConfirm, onCancel }: Props) {
  const t = useTranslations('admin.dashboard')
  const tc = useTranslations('common')
  const [value, setValue] = useState('')
  useEscapeKey(onCancel)

  const matches = value.trim().toLowerCase() === user.email.toLowerCase()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (matches) onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">{t('deleteModalTitle')}</p>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-th-fg-muted">
            {t('deleteModalMessage', { name: user.name, email: user.email })}
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-th-fg-muted">
              {t('deleteModalConfirmPrompt', { email: user.email })}
            </label>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={user.email}
              className="w-full rounded-md border border-th-border bg-th-input px-3 py-1.5 text-sm text-th-fg outline-none focus:border-th-accent focus:ring-1 focus:ring-th-accent/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={!matches}
            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('deleteModalConfirm')}
          </button>
        </div>
      </form>
    </div>
  )
}
