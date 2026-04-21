'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/components/ui/cn'
import type { RequestAuth } from '@/store/request.store'

interface Props {
  auth: RequestAuth
  onChange: (auth: RequestAuth) => void
}

const AUTH_TYPES = ['none', 'bearer', 'basic', 'api-key'] as const

export default function AuthTab({ auth, onChange }: Props) {
  const t = useTranslations('tabs')

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Auth type selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-th-fg-muted">{t('auth')}</span>
        <select
          value={auth.type}
          onChange={e => onChange({ ...auth, type: e.target.value as typeof AUTH_TYPES[number] })}
          className="rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
        >
          {AUTH_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {auth.type === 'none' && (
        <p className="text-xs text-th-fg-subtle">{t('noAuth')}</p>
      )}

      {auth.type === 'bearer' && (
        <Field label={t('token')}>
          <TokenInput
            value={auth.token ?? ''}
            onChange={v => onChange({ ...auth, token: v })}
            placeholder="{{token}}"
          />
        </Field>
      )}

      {auth.type === 'basic' && (
        <div className="flex flex-col gap-2">
          <Field label={t('username')}>
            <TokenInput
              value={auth.username ?? ''}
              onChange={v => onChange({ ...auth, username: v })}
              placeholder="{{username}}"
            />
          </Field>
          <Field label={t('password')}>
            <TokenInput
              value={auth.password ?? ''}
              onChange={v => onChange({ ...auth, password: v })}
              placeholder="{{password}}"
              type="password"
            />
          </Field>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-2">
          <Field label={t('apiKeyHeader')}>
            <TokenInput
              value={auth.apiKeyHeader ?? 'X-API-Key'}
              onChange={v => onChange({ ...auth, apiKeyHeader: v })}
              placeholder="X-API-Key"
            />
          </Field>
          <Field label={t('apiKey')}>
            <TokenInput
              value={auth.apiKey ?? ''}
              onChange={v => onChange({ ...auth, apiKey: v })}
              placeholder="{{apiKey}}"
            />
          </Field>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-th-fg-muted">{label}</label>
      {children}
    </div>
  )
}

function TokenInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-th-border bg-th-input px-2 py-1.5 font-mono text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
    />
  )
}
