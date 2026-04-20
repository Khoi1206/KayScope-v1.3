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
    <div className="flex flex-col gap-3 p-3">
      {/* Body type selector */}
      <div className="flex flex-wrap gap-1">
        {BODY_TYPES.map(type => (
          <button
            key={type}
            onClick={() => onChange({ ...body, type })}
            className={cn(
              'rounded px-2 py-0.5 text-xs',
              body.type === type
                ? 'bg-th-accent text-white'
                : 'border border-th-border text-th-fg-muted hover:text-th-fg'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Body content */}
      {body.type === 'none' && (
        <p className="text-xs text-th-fg-subtle">{t('noBody')}</p>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div>
          {body.type === 'raw' && (
            <div className="mb-2 flex gap-1">
              {RAW_TYPES.map(rt => (
                <button
                  key={rt}
                  onClick={() => onChange({ ...body, rawType: rt })}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs',
                    body.rawType === rt
                      ? 'bg-th-accent text-white'
                      : 'border border-th-border text-th-fg-muted hover:text-th-fg'
                  )}
                >
                  {rt}
                </button>
              ))}
            </div>
          )}
          <MonacoEditor
            value={body.content}
            onChange={content => onChange({ ...body, content })}
            language={body.type === 'json' ? 'json' : (body.rawType ?? 'plaintext')}
            height="180px"
          />
        </div>
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
  )
}
