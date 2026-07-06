'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { AdminUserRow } from './AdminUsersTable'

interface Props {
  /** null → create mode; otherwise edit mode */
  user: AdminUserRow | null
  onClose: () => void
  onSaved: () => void
}

export default function AdminUserModal({ user, onClose, onSaved }: Props) {
  const t = useTranslations('admin.userModal')
  const isEdit = user !== null
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(user?.isAdmin ?? false)
  const [isActive, setIsActive] = useState(user?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEscapeKey(onClose)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { name: name.trim(), email: email.trim(), isAdmin, isActive }
      if (isEdit) {
        if (password) payload.password = password
      } else {
        payload.password = password
      }
      const res = await fetch(isEdit ? `/api/admin/users/${user.id}` : '/api/admin/users', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? t('failedToSave'))
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSave'))
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">{isEdit ? t('editTitle') : t('createTitle')}</p>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="admin-user-name" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('name')}
            </label>
            <input
              id="admin-user-name"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="admin-user-email" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('email')}
            </label>
            <input
              id="admin-user-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="admin-user-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('password')}
            </label>
            <input
              id="admin-user-password"
              type="password"
              required={!isEdit}
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isEdit ? t('passwordKeepPlaceholder') : t('passwordPlaceholder')}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-th-fg">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={e => setIsAdmin(e.target.checked)}
                className="h-4 w-4 accent-th-accent"
              />
              {t('isAdmin')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-th-fg">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-th-accent"
              />
              {t('isActive')}
            </label>
          </div>

          {error && <p className="text-sm text-th-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-th-border px-3 py-1.5 text-sm text-th-fg-muted hover:bg-th-surface-hover"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-th-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
            >
              {saving ? t('saving') : isEdit ? t('save') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
