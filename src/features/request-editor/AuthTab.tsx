'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/components/ui/cn'
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
  onLocalScopeSet?: (key: string, value: string) => void
}

const AUTH_TYPES = ['none', 'bearer', 'basic', 'api-key', 'oauth2', 'oauth1', 'aws-sig-v4'] as const

const GRANT_TYPE_LABELS: Record<string, string> = {
  client_credentials: 'Client Credentials',
  password: 'Password Grant',
  authorization_code: 'Authorization Code',
}

export default function AuthTab({
  auth, onChange,
  localScope, environmentVariables, collectionVariables, globalVariables,
  hasCollection, hasEnvironment, collectionName, environmentName,
  onSaveVar, onNavigateToVariables,
  onLocalScopeSet,
}: Props) {
  const t = useTranslations('tabs')
  const [fetchingToken, setFetchingToken] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  const varProps = {
    localScope, environmentVariables, collectionVariables, globalVariables,
    hasCollection, hasEnvironment, collectionName, environmentName,
    onSaveVar, onNavigateToVariables,
  }

  async function handleGetToken() {
    setFetchingToken(true)
    setTokenStatus(null)
    try {
      const res = await fetch('/api/auth/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantType: auth.oauth2GrantType ?? 'client_credentials',
          tokenUrl: auth.oauth2TokenUrl ?? '',
          clientId: auth.oauth2ClientId ?? '',
          clientSecret: auth.oauth2ClientSecret ?? '',
          clientAuth: auth.oauth2ClientAuth ?? 'body',
          scope: auth.oauth2Scope ?? '',
          username: auth.oauth2Username ?? '',
          password: auth.oauth2Password ?? '',
          code: '',
          redirectUri: auth.oauth2RedirectUri ?? '',
        }),
      })
      const data = await res.json() as { access_token?: string; expires_in?: number; error?: string }
      if (!res.ok || data.error) {
        setTokenStatus({ ok: false, msg: data.error ?? `HTTP ${res.status}` })
      } else if (data.access_token) {
        onLocalScopeSet?.('_oauth2_token', data.access_token)
        onLocalScopeSet?.('_oauth2_token_expires_at', data.expires_in ? String(Date.now() + data.expires_in * 1000) : '')
        setTokenStatus({ ok: true, msg: `Token stored in local scope (_oauth2_token)` })
      }
    } catch (err) {
      setTokenStatus({ ok: false, msg: err instanceof Error ? err.message : 'Request failed' })
    } finally {
      setFetchingToken(false)
    }
  }

  const currentToken = localScope?.['_oauth2_token']
  const tokenExpiresAt = Number(localScope?.['_oauth2_token_expires_at'] ?? 0)
  const tokenExpired = tokenExpiresAt > 0 && Date.now() >= tokenExpiresAt
  const grant = auth.oauth2GrantType ?? 'client_credentials'

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Auth type selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-th-fg-muted">{t('auth')}</span>
        <select
          value={auth.type}
          onChange={e => onChange({ ...auth, type: e.target.value as typeof AUTH_TYPES[number] })}
          className="rounded-lg border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
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
          <VarAwareInput value={auth.token ?? ''} onChange={v => onChange({ ...auth, token: v })} placeholder="{{token}}" {...varProps} />
        </Field>
      )}

      {auth.type === 'basic' && (
        <div className="flex flex-col gap-2">
          <Field label={t('username')}>
            <VarAwareInput value={auth.username ?? ''} onChange={v => onChange({ ...auth, username: v })} placeholder="{{username}}" {...varProps} />
          </Field>
          <Field label={t('password')}>
            <VarAwareInput value={auth.password ?? ''} onChange={v => onChange({ ...auth, password: v })} placeholder="{{password}}" {...varProps} />
          </Field>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-2">
          <Field label={t('apiKeyHeader')}>
            <VarAwareInput value={auth.apiKeyHeader ?? 'X-API-Key'} onChange={v => onChange({ ...auth, apiKeyHeader: v })} placeholder="X-API-Key" {...varProps} />
          </Field>
          <Field label={t('apiKey')}>
            <VarAwareInput value={auth.apiKey ?? ''} onChange={v => onChange({ ...auth, apiKey: v })} placeholder="{{apiKey}}" {...varProps} />
          </Field>
        </div>
      )}

      {auth.type === 'oauth2' && (
        <div className="flex flex-col gap-3">
          {/* Grant Type */}
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium text-th-fg-muted">Grant Type</span>
            <select
              value={grant}
              onChange={e => onChange({ ...auth, oauth2GrantType: e.target.value as typeof grant })}
              className="rounded-lg border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            >
              {Object.entries(GRANT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Token URL */}
          <Field label="Token URL">
            <VarAwareInput value={auth.oauth2TokenUrl ?? ''} onChange={v => onChange({ ...auth, oauth2TokenUrl: v })} placeholder="https://auth.example.com/oauth/token" {...varProps} />
          </Field>

          {/* Client ID + Secret */}
          <Field label="Client ID">
            <VarAwareInput value={auth.oauth2ClientId ?? ''} onChange={v => onChange({ ...auth, oauth2ClientId: v })} placeholder="{{client_id}}" {...varProps} />
          </Field>
          <Field label="Client Secret">
            <VarAwareInput value={auth.oauth2ClientSecret ?? ''} onChange={v => onChange({ ...auth, oauth2ClientSecret: v })} placeholder="{{client_secret}}" {...varProps} />
          </Field>

          {/* Scope */}
          <Field label="Scope">
            <VarAwareInput value={auth.oauth2Scope ?? ''} onChange={v => onChange({ ...auth, oauth2Scope: v })} placeholder="read write" {...varProps} />
          </Field>

          {/* Client authentication mode */}
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium text-th-fg-muted">Client Auth</span>
            <select
              value={auth.oauth2ClientAuth ?? 'body'}
              onChange={e => onChange({ ...auth, oauth2ClientAuth: e.target.value as 'body' | 'basic_header' })}
              className="rounded-lg border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            >
              <option value="body">Send as request body</option>
              <option value="basic_header">Send as Basic Auth header</option>
            </select>
          </div>

          {/* Password grant extras */}
          {grant === 'password' && (
            <>
              <Field label="Username">
                <VarAwareInput value={auth.oauth2Username ?? ''} onChange={v => onChange({ ...auth, oauth2Username: v })} placeholder="{{oauth2_username}}" {...varProps} />
              </Field>
              <Field label="Password">
                <VarAwareInput value={auth.oauth2Password ?? ''} onChange={v => onChange({ ...auth, oauth2Password: v })} placeholder="{{oauth2_password}}" {...varProps} />
              </Field>
            </>
          )}

          {/* Authorization Code note */}
          {grant === 'authorization_code' && (
            <div className="rounded-lg border border-th-border bg-th-surface p-3 text-xs text-th-fg-muted">
              Authorization Code flow requires the access token to be obtained externally and stored as <code className="rounded bg-th-surface px-1 py-0.5 font-mono text-th-fg">_oauth2_token</code> in local scope.
            </div>
          )}

          {/* Get Token button */}
          {grant !== 'authorization_code' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleGetToken}
                disabled={fetchingToken || !auth.oauth2TokenUrl || !auth.oauth2ClientId || !auth.oauth2ClientSecret}
                className="flex w-fit items-center gap-2 rounded-lg border border-th-border bg-th-surface px-3 py-1.5 text-xs font-medium text-th-fg transition-colors hover:bg-th-surface-hover disabled:opacity-40"
              >
                {fetchingToken && <Loader2 size={12} className="animate-spin" />}
                Get Access Token
              </button>
              {tokenStatus && (
                <div className={cn('flex items-center gap-1.5 text-xs', tokenStatus.ok ? 'text-green-500' : 'text-red-400')}>
                  {tokenStatus.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                  {tokenStatus.msg}
                </div>
              )}
            </div>
          )}

          {/* Current token preview */}
          {currentToken && (
            <div className="rounded-lg border border-th-border bg-th-surface p-2">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-th-fg-muted">
                <span>Current token (local scope)</span>
                {tokenExpiresAt > 0 && (
                  <span className={cn(tokenExpired ? 'text-red-400' : 'text-green-500')}>
                    {tokenExpired ? 'Expired' : `Valid until ${new Date(tokenExpiresAt).toLocaleTimeString()}`}
                  </span>
                )}
              </div>
              <code className="break-all font-mono text-[10px] text-th-fg-subtle">
                {currentToken.length > 60 ? `${currentToken.slice(0, 30)}…${currentToken.slice(-20)}` : currentToken}
              </code>
            </div>
          )}

          {/* Auto-fetch note for client_credentials */}
          {grant === 'client_credentials' && (!currentToken || tokenExpired) && (
            <p className="text-[11px] text-th-fg-subtle">
              Token will be auto-fetched at execute time (missing or expired tokens are refreshed automatically).
            </p>
          )}
        </div>
      )}

      {auth.type === 'oauth1' && (
        <div className="flex flex-col gap-2">
          <Field label="Consumer Key">
            <VarAwareInput value={auth.oauth1ConsumerKey ?? ''} onChange={v => onChange({ ...auth, oauth1ConsumerKey: v })} placeholder="{{consumer_key}}" {...varProps} />
          </Field>
          <Field label="Consumer Secret">
            <VarAwareInput value={auth.oauth1ConsumerSecret ?? ''} onChange={v => onChange({ ...auth, oauth1ConsumerSecret: v })} placeholder="{{consumer_secret}}" {...varProps} />
          </Field>
          <Field label="Token">
            <VarAwareInput value={auth.oauth1Token ?? ''} onChange={v => onChange({ ...auth, oauth1Token: v })} placeholder="{{oauth_token}}" {...varProps} />
          </Field>
          <Field label="Token Secret">
            <VarAwareInput value={auth.oauth1TokenSecret ?? ''} onChange={v => onChange({ ...auth, oauth1TokenSecret: v })} placeholder="{{oauth_token_secret}}" {...varProps} />
          </Field>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium text-th-fg-muted">Signature Method</span>
            <select
              value={auth.oauth1SignatureMethod ?? 'HMAC-SHA1'}
              onChange={e => onChange({ ...auth, oauth1SignatureMethod: e.target.value as 'HMAC-SHA1' | 'HMAC-SHA256' })}
              className="rounded-lg border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            >
              <option value="HMAC-SHA1">HMAC-SHA1</option>
              <option value="HMAC-SHA256">HMAC-SHA256</option>
            </select>
          </div>
          <Field label="Realm (optional)">
            <VarAwareInput value={auth.oauth1Realm ?? ''} onChange={v => onChange({ ...auth, oauth1Realm: v })} {...varProps} />
          </Field>
        </div>
      )}

      {auth.type === 'aws-sig-v4' && (
        <div className="flex flex-col gap-2">
          <Field label="Access Key ID">
            <VarAwareInput value={auth.awsAccessKeyId ?? ''} onChange={v => onChange({ ...auth, awsAccessKeyId: v })} placeholder="{{aws_access_key_id}}" {...varProps} />
          </Field>
          <Field label="Secret Access Key">
            <VarAwareInput value={auth.awsSecretAccessKey ?? ''} onChange={v => onChange({ ...auth, awsSecretAccessKey: v })} placeholder="{{aws_secret_access_key}}" {...varProps} />
          </Field>
          <Field label="Session Token (optional)">
            <VarAwareInput value={auth.awsSessionToken ?? ''} onChange={v => onChange({ ...auth, awsSessionToken: v })} {...varProps} />
          </Field>
          <Field label="Region">
            <VarAwareInput value={auth.awsRegion ?? ''} onChange={v => onChange({ ...auth, awsRegion: v })} placeholder="us-east-1" {...varProps} />
          </Field>
          <Field label="Service">
            <VarAwareInput value={auth.awsService ?? ''} onChange={v => onChange({ ...auth, awsService: v })} placeholder="execute-api" {...varProps} />
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
      <div className="rounded-lg border border-th-border bg-th-input">{children}</div>
    </div>
  )
}
