'use client'

import { useEffect, useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'

export default function LoginForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState({ email: '', password: '' })
  // Guards against a native form submit (which would leak credentials into the
  // URL as a GET query string) if the button is clicked before React hydrates.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await signIn('credentials', {
        email: fields.email,
        password: fields.password,
        redirect: false,
      })
      if (res?.error) {
        setError(res.code === 'account_disabled' ? t('accountDisabled') : t('invalidCredentials'))
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    })
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-th-border bg-th-surface p-8 shadow-md">
      <h1 className="mb-6 text-xl font-semibold text-th-fg">{t('loginTitle')}</h1>

      <form onSubmit={handleSubmit} method="post" className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-th-fg-muted">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={fields.email}
            onChange={handleChange}
            className="w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-th-fg-muted">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={fields.password}
            onChange={handleChange}
            className="w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent"
          />
        </div>

        {error && (
          <p className="text-sm text-th-error">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending || !mounted}
          className="w-full rounded-md bg-th-accent px-4 py-2 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
        >
          {isPending ? t('signingIn') : t('signIn')}
        </button>
      </form>

      {/* Self-registration is disabled — accounts are created by an admin in the CMS.
      <p className="mt-4 text-center text-sm text-th-fg-muted">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-th-accent hover:underline">
          {t('register')}
        </Link>
      </p>
      */}
    </div>
  )
}
