'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface EmailSettings {
  host: string
  port: number
  secure: boolean
  username: string
  password: string // masked or ''
  fromAddress: string
  fromName: string
}

const inputClass =
  'w-full rounded-md border border-th-border bg-th-input px-3 py-2 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent'

export default function EmailSettingsPanel() {
  const t = useTranslations('admin.emailSettings')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [host, setHost] = useState('')
  const [port, setPort] = useState(587)
  const [secure, setSecure] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [fromName, setFromName] = useState('')

  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/email-settings')
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t('failedToLoad'))
        return res.json() as Promise<EmailSettings>
      })
      .then(data => {
        if (cancelled) return
        setHost(data.host)
        setPort(data.port)
        setSecure(data.secure)
        setUsername(data.username)
        setFromAddress(data.fromAddress)
        setFromName(data.fromName)
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/email-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, secure, username, password, fromAddress, fromName }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? t('failedToSave'))
      }
      setPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    setTestResult(null)
    setTesting(true)
    try {
      const res = await fetch('/api/admin/email-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setTestResult({ ok: false, message: body?.error ?? t('testFailed') })
      } else if (body?.success) {
        setTestResult({ ok: true, message: t('testSuccess') })
      } else {
        setTestResult({ ok: false, message: body?.error ?? t('testFailed') })
      }
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : t('testFailed') })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <p className="p-6 text-xs text-th-fg-subtle">…</p>
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h2 className="mb-1 text-sm font-semibold text-th-fg">{t('title')}</h2>
      <p className="mb-4 text-xs text-th-fg-subtle">{t('subtitle')}</p>

      <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-th-border bg-th-surface p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="email-host" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('host')}
            </label>
            <input id="email-host" value={host} onChange={e => setHost(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="email-port" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('port')}
            </label>
            <input
              id="email-port"
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={e => setPort(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-th-fg-muted">
          <input type="checkbox" checked={secure} onChange={e => setSecure(e.target.checked)} />
          {t('secure')}
        </label>

        <div>
          <label htmlFor="email-username" className="mb-1 block text-sm font-medium text-th-fg-muted">
            {t('username')}
          </label>
          <input
            id="email-username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email-password" className="mb-1 block text-sm font-medium text-th-fg-muted">
            {t('password')}
          </label>
          <input
            id="email-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('passwordKeepPlaceholder')}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="email-from-address" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('fromAddress')}
            </label>
            <input
              id="email-from-address"
              type="email"
              value={fromAddress}
              onChange={e => setFromAddress(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="email-from-name" className="mb-1 block text-sm font-medium text-th-fg-muted">
              {t('fromName')}
            </label>
            <input
              id="email-from-name"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-sm text-th-error">{error}</p>}
        {success && <p className="text-sm text-emerald-500">{t('saved')}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-th-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-lg border border-th-border bg-th-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-th-fg">{t('testEmailTitle')}</h3>
        <div className="flex gap-2">
          <input
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            placeholder={t('testEmailPlaceholder')}
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleTestSend}
            disabled={testing || !testTo}
            className="shrink-0 rounded-md border border-th-border px-3 py-1.5 text-sm text-th-fg-muted hover:bg-th-surface-hover disabled:opacity-50"
          >
            {testing ? t('sending') : t('sendTest')}
          </button>
        </div>
        {testResult && (
          <p className={`mt-2 text-sm ${testResult.ok ? 'text-emerald-500' : 'text-th-error'}`}>
            {testResult.message}
          </p>
        )}
      </div>
    </div>
  )
}
