'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/routing'

export default function RegisterForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState({ name: '', email: '', password: '' })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFields(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? t('registrationFailed'))
        return
      }
      const signInRes = await signIn('credentials', {
        email: fields.email,
        password: fields.password,
        redirect: false,
      })
      if (signInRes?.error) {
        setError(t('registrationFailed'))
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    })
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-th-border bg-th-surface p-8 shadow-sm">
      <h1 className="mb-6 text-xl font-semibold text-th-fg">{t('registerTitle')}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-th-fg-muted">
            {t('name')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={fields.name}
            onChange={handleChange}
            className="w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent"
            placeholder="Your name"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
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
          disabled={isPending}
          className="w-full rounded-md bg-th-accent px-4 py-2 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
        >
          {isPending ? t('creatingAccount') : t('createAccount')}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-th-fg-muted">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-th-accent hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  )
}
