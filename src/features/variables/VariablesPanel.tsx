'use client'

import { useTranslations } from 'next-intl'
import type { RequestAuth } from '@/store/request.store'

interface VarEntry {
  name: string
  scope: string
  value: string
  resolved: boolean
  secret?: boolean
}

interface Props {
  localScope: Record<string, string>
  environmentVariables: Record<string, string>
  collectionVariables?: Record<string, string>
  globalVariables?: Record<string, string>
  url: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  params: Array<{ key: string; value: string; enabled: boolean }>
  auth?: RequestAuth
}

const VAR_RE = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g

function extractVarNames(text: string): string[] {
  const names: string[] = []
  let m: RegExpExecArray | null
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) {
    names.push(m[1]!.trim())
  }
  return names
}

export default function VariablesPanel({ localScope, environmentVariables, collectionVariables = {}, globalVariables = {}, url, headers, params, auth }: Props) {
  const t = useTranslations('variables')

  // Collect all var names referenced in the current request
  const authTexts: string[] = auth && auth.type !== 'none' ? (() => {
    if (auth.type === 'bearer') return [auth.token ?? '']
    if (auth.type === 'basic') return [auth.username ?? '', auth.password ?? '']
    if (auth.type === 'api-key') return [auth.apiKeyHeader ?? '', auth.apiKey ?? '']
    return []
  })() : []

  const texts = [
    url,
    ...headers.filter(h => h.enabled).flatMap(h => [h.key, h.value]),
    ...params.filter(p => p.enabled).flatMap(p => [p.key, p.value]),
    ...authTexts,
  ]
  const referencedNames = [...new Set(texts.flatMap(extractVarNames))]

  const entries: VarEntry[] = referencedNames.map(name => {
    if (name in localScope) {
      return { name, scope: 'local', value: localScope[name]!, resolved: true }
    }
    if (name in environmentVariables) {
      return { name, scope: 'environment', value: environmentVariables[name]!, resolved: true }
    }
    if (name in collectionVariables) {
      return { name, scope: 'collection', value: collectionVariables[name]!, resolved: true }
    }
    if (name in globalVariables) {
      return { name, scope: 'global', value: globalVariables[name]!, resolved: true }
    }
    return { name, scope: '—', value: '', resolved: false }
  })

  // Also show all local scope vars even if not directly referenced
  for (const [key, value] of Object.entries(localScope)) {
    if (!entries.find(e => e.name === key)) {
      entries.push({ name: key, scope: 'local', value, resolved: true })
    }
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-th-fg-subtle">
        {t('title')} — none referenced yet
      </div>
    )
  }

  return (
    <div className="p-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-th-border">
            <th className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">{t('keyHeader')}</th>
            <th className="pb-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">{t('scopeHeader')}</th>
            <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">{t('valueHeader')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.name} className="border-b border-th-border/40 transition-colors hover:bg-th-surface-hover/40">
              <td className="py-2 pr-4 font-mono text-th-fg">{`{{${entry.name}}}`}</td>
              <td className="py-2 pr-4">
                <span className="rounded-md bg-th-surface px-2 py-0.5 text-[11px] font-medium text-th-fg-muted">
                  {entry.scope}
                </span>
              </td>
              <td className="py-2">
                {entry.resolved ? (
                  <span className="font-mono text-th-accent">{entry.value || <span className="text-th-fg-subtle italic">empty</span>}</span>
                ) : (
                  <span className="rounded-md bg-yellow-500/10 px-2 py-0.5 text-[11px] font-medium text-yellow-400">{t('unresolved')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
