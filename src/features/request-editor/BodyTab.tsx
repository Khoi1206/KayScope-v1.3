'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/components/ui/cn'
import KVEditor, { type KVRow } from '@/components/KVEditor'
import MonacoEditor from '@/components/MonacoEditor'
import type { RequestBody } from '@/store/request.store'

interface Props {
  body: RequestBody
  onChange: (body: RequestBody) => void
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  onSetLocalVar?: (name: string, value: string) => void
}

const BODY_TYPES = ['none', 'json', 'raw', 'form-data', 'x-www-form-urlencoded'] as const
const RAW_TYPES = ['text', 'json', 'javascript', 'html', 'xml'] as const

export default function BodyTab({ body, onChange, localScope, environmentVariables, onSetLocalVar }: Props) {
  const t = useTranslations('tabs')

  return (
    <div className="flex flex-col">
      {/* Body type tab strip */}
      <div className="flex items-center border-b border-th-border px-3">
        {BODY_TYPES.map(type => (
          <button
            key={type}
            onClick={() => onChange({ ...body, type })}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              body.type === type
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {type}
          </button>
        ))}

        {/* Raw type select — shown inline when raw is active */}
        {body.type === 'raw' && (
          <select
            value={body.rawType ?? 'text'}
            onChange={e => onChange({ ...body, rawType: e.target.value as typeof RAW_TYPES[number] })}
            className="rounded border border-th-border bg-th-input px-2 py-1 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
          >
            {RAW_TYPES.map(rt => (
              <option key={rt} value={rt}>{rt}</option>
            ))}
          </select>
        )}
      </div>

      {/* Body content */}
      <div className="p-3">
        {body.type === 'none' && (
          <p className="text-xs text-th-fg-subtle">{t('noBody')}</p>
        )}

        {(body.type === 'json' || body.type === 'raw') && (
          <MonacoEditor
            value={body.content}
            onChange={content => onChange({ ...body, content })}
            language={body.type === 'json' ? 'json' : (body.rawType ?? 'plaintext')}
            height="180px"
          />
        )}

        {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
          <KVEditor
            rows={body.formData ?? []}
            onChange={rows => onChange({ ...body, formData: rows })}
            keyPlaceholder="Field"
            valuePlaceholder="Value"
            localScope={localScope}
            environmentVariables={environmentVariables}
            onSetLocalVar={onSetLocalVar}
          />
        )}
      </div>
    </div>
  )
}
