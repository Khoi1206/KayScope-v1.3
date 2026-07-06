'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionProvider, useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  onClose: () => void
  /** Optional: lets the parent update its displayed user name immediately. */
  onNameChanged?: (name: string) => void
}

/** Wrapped in a local SessionProvider so useSession().update() works regardless of where the modal is mounted. */
export default function ProfileModal(props: Props) {
  return (
    <SessionProvider>
      <ProfileModalInner {...props} />
    </SessionProvider>
  )
}

function ProfileModalInner({ onClose, onNameChanged }: Props) {
  const t = useTranslations('profile')
  const router = useRouter()
  const { update } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  useEscapeKey(onClose)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile')
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t('failedToLoad'))
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setName(data.name)
        setEmail(data.email)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('failedToLoad'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const wantsPasswordChange = newPassword.length > 0
    if (wantsPasswordChange && newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }
    if (wantsPasswordChange && !currentPassword) {
      setError(t('currentPasswordRequired'))
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = { name: name.trim() }
      if (wantsPasswordChange) {
        payload.currentPassword = currentPassword
        payload.newPassword = newPassword
      }
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? t('failedToSave'))
      }
      const updated = await res.json()
      // Refresh the JWT session so server components render the new name
      await update({ name: updated.name }).catch(() => {})
      onNameChanged?.(updated.name)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSave'))
    } finally {
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
          <p className="text-sm font-semibold text-th-fg">{t('title')}</p>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-xs text-th-fg-subtle">{t('loading')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            <div>
              <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-th-fg-muted">
                {t('email')}
              </label>
              <input id="profile-email" value={email} disabled className={`${inputClass} opacity-60`} />
            </div>

            <div>
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-th-fg-muted">
                {t('name')}
              </label>
              <input
                id="profile-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="border-t border-th-border pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-th-fg-muted">
                {t('changePassword')}
              </p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="profile-current-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
                    {t('currentPassword')}
                  </label>
                  <input
                    id="profile-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-new-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
                    {t('newPassword')}
                  </label>
                  <input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('newPasswordPlaceholder')}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="profile-confirm-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
                    {t('confirmPassword')}
                  </label>
                  <input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-th-error">{error}</p>}
            {success && <p className="text-sm text-emerald-500">{t('saved')}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-th-border px-3 py-1.5 text-sm text-th-fg-muted hover:bg-th-surface-hover"
              >
                {t('close')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-th-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
