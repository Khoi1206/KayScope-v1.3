'use client'

import type { FlowEdge, FlowEdgeData } from '@/db/schema/flows'

interface Props {
  edge: FlowEdge
  siblingCount: number  // number of other outgoing edges from the same source
  onChange: (id: string, data: FlowEdgeData) => void
  onClose: () => void
}

const CONDITIONS = [
  { value: 'always', label: 'Always' },
  { value: 'if_visible', label: 'If visible' },
  { value: 'if_not_visible', label: 'If not visible' },
] as const

export default function EdgeConditionPanel({ edge, siblingCount, onChange, onClose }: Props) {
  const condition = edge.data?.condition ?? 'always'
  const conditionText = edge.data?.conditionText ?? ''

  function set(patch: Partial<FlowEdgeData>) {
    onChange(edge.id, { condition, conditionText, ...patch })
  }

  return (
    <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 w-72 rounded-lg border border-th-border bg-th-bg shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-th-fg">Edge Condition</p>
        <button onClick={onClose} className="text-xs text-th-fg-muted hover:text-th-fg">✕</button>
      </div>

      {siblingCount >= 2 && (
        <p className="mb-2 rounded bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-400">
          Warning: source node already has 2 outgoing edges. Max 2 allowed.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-th-fg-muted">Condition</label>
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
            <label className="text-[11px] text-th-fg-muted">Text to check visibility</label>
            <input
              className="rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
              value={conditionText}
              onChange={e => set({ conditionText: e.target.value })}
              placeholder="e.g. Login button"
            />
          </div>
        )}
      </div>
    </div>
  )
}
