'use client'

import { useTranslations } from 'next-intl'
import { VarAwareInput } from '@/components/KVEditor'
import type { RequestAuth } from '@/store/request.store'
import type { SaveScope } from '@/components/VarHoverPopover'

interface Props {
  auth: RequestAuth
  onChange: (auth: RequestAuth) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  collectionVariables?: Record<string, string>
  globalVariables?: Record<string, string>
  hasCollection?: boolean
  hasEnvironment?: boolean
  collectionName?: string
  environmentName?: string
  onSaveVar?: (scope: SaveScope, name: string, value: string) => Promise<void>
  onNavigateToVariables?: () => void
}

const AUTH_TYPES = ['none', 'bearer', 'basic', 'api-key'] as const

export default function AuthTab({
  auth, onChange,
  localScope, environmentVariables, collectionVariables, globalVariables,
  hasCollection, hasEnvironment, collectionName, environmentName,
  onSaveVar, onNavigateToVariables,
}: Props) {
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
          <VarAwareInput
            value={auth.token ?? ''}
            onChange={v => onChange({ ...auth, token: v })}
            placeholder="{{token}}"
            localScope={localScope} environmentVariables={environmentVariables}
            collectionVariables={collectionVariables} globalVariables={globalVariables}
            hasCollection={hasCollection} hasEnvironment={hasEnvironment}
            collectionName={collectionName} environmentName={environmentName}
            onSaveVar={onSaveVar} onNavigateToVariables={onNavigateToVariables}
          />
        </Field>
      )}

      {auth.type === 'basic' && (
        <div className="flex flex-col gap-2">
          <Field label={t('username')}>
            <VarAwareInput
              value={auth.username ?? ''}
              onChange={v => onChange({ ...auth, username: v })}
              placeholder="{{username}}"
              localScope={localScope} environmentVariables={environmentVariables}
              collectionVariables={collectionVariables} globalVariables={globalVariables}
              hasCollection={hasCollection} hasEnvironment={hasEnvironment}
              collectionName={collectionName} environmentName={environmentName}
              onSaveVar={onSaveVar} onNavigateToVariables={onNavigateToVariables}
            />
          </Field>
          <Field label={t('password')}>
            <VarAwareInput
              value={auth.password ?? ''}
              onChange={v => onChange({ ...auth, password: v })}
              placeholder="{{password}}"
              localScope={localScope} environmentVariables={environmentVariables}
              collectionVariables={collectionVariables} globalVariables={globalVariables}
              hasCollection={hasCollection} hasEnvironment={hasEnvironment}
              collectionName={collectionName} environmentName={environmentName}
              onSaveVar={onSaveVar} onNavigateToVariables={onNavigateToVariables}
            />
          </Field>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-2">
          <Field label={t('apiKeyHeader')}>
            <VarAwareInput
              value={auth.apiKeyHeader ?? 'X-API-Key'}
              onChange={v => onChange({ ...auth, apiKeyHeader: v })}
              placeholder="X-API-Key"
              localScope={localScope} environmentVariables={environmentVariables}
              collectionVariables={collectionVariables} globalVariables={globalVariables}
              hasCollection={hasCollection} hasEnvironment={hasEnvironment}
              collectionName={collectionName} environmentName={environmentName}
              onSaveVar={onSaveVar} onNavigateToVariables={onNavigateToVariables}
            />
          </Field>
          <Field label={t('apiKey')}>
            <VarAwareInput
              value={auth.apiKey ?? ''}
              onChange={v => onChange({ ...auth, apiKey: v })}
              placeholder="{{apiKey}}"
              localScope={localScope} environmentVariables={environmentVariables}
              collectionVariables={collectionVariables} globalVariables={globalVariables}
              hasCollection={hasCollection} hasEnvironment={hasEnvironment}
              collectionName={collectionName} environmentName={environmentName}
              onSaveVar={onSaveVar} onNavigateToVariables={onNavigateToVariables}
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
      <div className="rounded-md border border-th-border bg-th-input">{children}</div>
    </div>
  )
}
