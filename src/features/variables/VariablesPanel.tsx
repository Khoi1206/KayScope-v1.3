'use client'

import { useTranslations } from 'next-intl'

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
  url: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  params: Array<{ key: string; value: string; enabled: boolean }>
}

const VAR_RE = /\{\{([^}]+)\}\}/g

function extractVarNames(text: string): string[] {
  const names: string[] = []
  let m: RegExpExecArray | null
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) {
    names.push(m[1]!.trim())
  }
  return names
}

export default function VariablesPanel({ localScope, environmentVariables, url, headers, params }: Props) {
  const t = useTranslations('variables')

  // Collect all var names referenced in the current request
  const texts = [
    url,
    ...headers.filter(h => h.enabled).flatMap(h => [h.key, h.value]),
    ...params.filter(p => p.enabled).flatMap(p => [p.key, p.value]),
  ]
  const referencedNames = [...new Set(texts.flatMap(extractVarNames))]

  // Build a merged lookup (local overrides env)
  const allResolved: Record<string, string> = { ...environmentVariables, ...localScope }

  const entries: VarEntry[] = referencedNames.map(name => {
    if (name in localScope) {
      return { name, scope: 'local', value: localScope[name]!, resolved: true }
    }
    if (name in environmentVariables) {
      return { name, scope: 'environment', value: environmentVariables[name]!, resolved: true }
    }
    return { name, scope: '—', value: '', resolved: false }
  })

  // Also show all local scope vars even if not directly referenced
  for (const [key, value] of Object.entries(localScope)) {
    if (!entries.find(e => e.name === key)) {
      entries.push({ name: key, scope: 'local', value, resolved: true })
    }
  }

  void allResolved

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
          <tr className="border-b border-th-border text-left text-th-fg-muted">
            <th className="pb-2 pr-4 font-medium">{t('keyHeader')}</th>
            <th className="pb-2 pr-4 font-medium">{t('scopeHeader')}</th>
            <th className="pb-2 font-medium">{t('valueHeader')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.name} className="border-b border-th-border/50">
              <td className="py-1.5 pr-4 font-mono text-th-fg">{entry.name}</td>
              <td className="py-1.5 pr-4 text-th-fg-muted">{entry.scope}</td>
              <td className="py-1.5">
                {entry.resolved ? (
                  <span className="font-mono text-th-accent">{entry.value || '(empty)'}</span>
                ) : (
                  <span className="text-yellow-400">{t('unresolved')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
