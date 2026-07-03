'use client'

import { useTranslations } from 'next-intl'
import type { FlowEdge, FlowEdgeData } from '@/db/schema/flows'

interface Props {
  edge: FlowEdge
  siblingCount: number  // number of other outgoing edges from the same source
  onChange: (id: string, data: FlowEdgeData) => void
  onClose: () => void
}

export default function EdgeConditionPanel({ edge, siblingCount, onChange, onClose }: Props) {
  const t = useTranslations('flows')
  const condition = edge.data?.condition ?? 'always'
  const conditionText = edge.data?.conditionText ?? ''

  const CONDITIONS = [
    { value: 'always', label: t('conditionAlways') },
    { value: 'if_visible', label: t('conditionIfVisible') },
    { value: 'if_not_visible', label: t('conditionIfNotVisible') },
  ] as const

  function set(patch: Partial<FlowEdgeData>) {
    onChange(edge.id, { condition, conditionText, ...patch })
  }

  return (
    <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 w-72 rounded-xl border border-th-border bg-th-bg shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-th-fg">{t('edgeCondition')}</p>
        <button onClick={onClose} className="text-xs text-th-fg-muted hover:text-th-fg">✕</button>
      </div>

      {siblingCount >= 2 && (
        <p className="mb-2 rounded bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-400">
          {t('edge.warning')}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-th-fg-muted">{t('edge.conditionLabel')}</label>
          <select
            value={condition}
            onChange={e => set({ condition: e.target.value as FlowEdgeData['condition'] })}
            className="rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
          >
            {CONDITIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {condition !== 'always' && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-th-fg-muted">{t('edge.visibilityLabel')}</label>
            <input
              className="rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
              value={conditionText}
              onChange={e => set({ conditionText: e.target.value })}
              placeholder={t('edge.visibilityPlaceholder')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
