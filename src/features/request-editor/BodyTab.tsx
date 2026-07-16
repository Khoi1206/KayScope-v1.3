'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/components/ui/cn'
import KVEditor, { type KVRow } from '@/components/KVEditor'
import MonacoEditor from '@/components/MonacoEditor'
import type { RequestBody } from '@/store/request.store'
import type { SaveScope } from '@/components/VarHoverPopover'

interface Props {
  body: RequestBody
  onChange: (body: RequestBody) => void
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

const BODY_TYPES = ['none', 'raw', 'form-data', 'x-www-form-urlencoded', 'graphql'] as const
const RAW_TYPES = ['text', 'json', 'javascript', 'html', 'xml'] as const

function inferContentType(body: { type: string; rawType?: string }): string | null {
  if (body.type === 'none') return null
  if (body.type === 'raw' || body.type === 'json') {
    const rt = body.rawType ?? 'text'
    if (rt === 'json') return 'application/json'
    if (rt === 'html') return 'text/html'
    if (rt === 'xml') return 'application/xml'
    if (rt === 'javascript') return 'application/javascript'
    return 'text/plain'
  }
  if (body.type === 'form-data') return 'multipart/form-data'
  if (body.type === 'x-www-form-urlencoded') return 'application/x-www-form-urlencoded'
  if (body.type === 'graphql') return 'application/json'
  return null
}

export default function BodyTab({
  body, onChange,
  localScope, environmentVariables, collectionVariables, globalVariables,
  hasCollection, hasEnvironment, collectionName, environmentName,
  onSaveVar, onNavigateToVariables,
}: Props) {
  const t = useTranslations('tabs')

  // Normalize legacy 'json' body type (stored before 'json' tab was removed).
  const effectiveType = body.type === 'json' ? 'raw' : body.type
  const monoLanguage = body.type === 'json' ? 'json' : (body.rawType ?? 'text')

  function handleTypeChange(type: typeof BODY_TYPES[number]) {
    if (type === 'raw' && body.type === 'json') {
      // Migrate legacy 'json' → 'raw' keeping json rawType
      onChange({ ...body, type: 'raw', rawType: 'json' })
    } else {
      onChange({ ...body, type })
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Body type tab strip */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-th-border bg-th-surface px-2 py-1">
        {BODY_TYPES.map(type => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-medium transition-all duration-150',
              effectiveType === type
                ? 'bg-th-bg text-th-fg shadow-sm'
                : 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
            )}
          >
            {type}
          </button>
        ))}

        {/* Raw type select — shown inline when raw (or legacy json) is active */}
        {(body.type === 'raw' || body.type === 'json') && (
          <select
            value={monoLanguage}
            onChange={e => onChange({ ...body, type: 'raw', rawType: e.target.value as typeof RAW_TYPES[number] })}
            className="rounded-lg border border-th-border bg-th-input px-2 py-1 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
          >
            {RAW_TYPES.map(rt => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
        )}

        {/* Content-Type badge — shows what header will be sent */}
        {inferContentType(body) && (
          <span
            className="ml-auto mr-1 rounded bg-th-surface-hover px-2 py-0.5 font-mono text-[10px] text-th-fg-muted"
            title="This Content-Type header will be automatically added when sending"
          >
            {inferContentType(body)}
          </span>
        )}
      </div>

      {/* Body content */}
      {body.type === 'none' && (
        <p className="p-3 text-xs text-th-fg-subtle">{t('noBody')}</p>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div className="min-h-0 flex-1 p-3">
          <MonacoEditor
            value={body.content}
            onChange={content => onChange({ ...body, content })}
            language={monoLanguage === 'text' ? 'plaintext' : monoLanguage}
            height="100%"
          />
        </div>
      )}

      {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <KVEditor
            rows={body.formData ?? []}
            onChange={rows => onChange({ ...body, formData: rows })}
            keyPlaceholder="Field"
            valuePlaceholder="Value"
            showFileType={body.type === 'form-data'}
            localScope={localScope}
            environmentVariables={environmentVariables}
            collectionVariables={collectionVariables}
            globalVariables={globalVariables}
            hasCollection={hasCollection}
            hasEnvironment={hasEnvironment}
            collectionName={collectionName}
            environmentName={environmentName}
            onSaveVar={onSaveVar}
            onNavigateToVariables={onNavigateToVariables}
          />
        </div>
      )}

      {body.type === 'graphql' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex min-h-[140px] flex-1 flex-col">
            <label className="mb-1 block text-xs font-medium text-th-fg-muted">{t('graphqlQuery')}</label>
            <MonacoEditor
              value={body.graphqlQuery ?? ''}
              onChange={graphqlQuery => onChange({ ...body, graphqlQuery })}
              language="plaintext"
              height="100%"
            />
          </div>
          <div className="flex min-h-[100px] flex-col">
            <label className="mb-1 block text-xs font-medium text-th-fg-muted">{t('graphqlVariables')}</label>
            <MonacoEditor
              value={body.graphqlVariables ?? ''}
              onChange={graphqlVariables => onChange({ ...body, graphqlVariables })}
              language="json"
              height="100px"
            />
          </div>
          <div className="shrink-0">
            <label className="mb-1 block text-xs font-medium text-th-fg-muted">{t('graphqlOperationName')}</label>
            <input
              className="w-full rounded-lg border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
              value={body.graphqlOperationName ?? ''}
              onChange={e => onChange({ ...body, graphqlOperationName: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
