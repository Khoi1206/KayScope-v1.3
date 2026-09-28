'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'

const inputClass =
  'w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent'

export default function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<'request' | 'reset' | 'done'>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, locale }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? t('forgotPassword.genericError'))
        }
        setPhase('reset')
      } catch (err) {
        setError(err instanceof Error ? err.message : t('forgotPassword.genericError'))
      }
    })
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError(t('forgotPassword.passwordMismatch'))
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, newPassword, locale }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? t('forgotPassword.invalidOrExpiredCode'))
        }
        setPhase('done')
      } catch (err) {
        setError(err instanceof Error ? err.message : t('forgotPassword.invalidOrExpiredCode'))
      }
    })
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-th-border bg-th-surface p-8 shadow-md">
      <h1 className="mb-6 text-xl font-semibold text-th-fg">{t('forgotPassword.title')}</h1>

      {phase === 'request' && (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <div>
            <label htmlFor="fp-email" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('email')}
            </label>
            <input
              id="fp-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          {error && <p className="text-sm text-th-error">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-th-accent px-4 py-2 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
          >
            {isPending ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
          </button>
        </form>
      )}

      {phase === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-th-fg-muted">{t('forgotPassword.codeSentMessage')}</p>
          <div>
            <label htmlFor="fp-code" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('forgotPassword.code')}
            </label>
            <input
              id="fp-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fp-new-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('forgotPassword.newPassword')}
            </label>
            <input
              id="fp-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fp-confirm-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('forgotPassword.confirmPassword')}
            </label>
            <input
              id="fp-confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-th-error">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-th-accent px-4 py-2 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
          >
            {isPending ? t('forgotPassword.resettingPassword') : t('forgotPassword.resetPassword')}
          </button>
        </form>
      )}

      {phase === 'done' && (
        <p className="text-sm text-th-fg-muted">{t('forgotPassword.successMessage')}</p>
      )}

      <p className="mt-4 text-center text-sm text-th-fg-muted">
        <Link href="/login" className="text-th-accent hover:underline">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </div>
  )
}
