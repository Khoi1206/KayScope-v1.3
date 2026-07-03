'use client'

import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useTranslations } from 'next-intl'
import { cn } from '@/components/ui/cn'
import type { FlowNodeData, NodeType } from '@/db/schema/flows'

const CATEGORY_COLORS: Record<NodeType, string> = {
  navigate: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  click_text: 'bg-green-500/15 text-green-400 border-green-500/30',
  click_role: 'bg-green-500/15 text-green-400 border-green-500/30',
  click_placeholder: 'bg-green-500/15 text-green-400 border-green-500/30',
  click_title: 'bg-green-500/15 text-green-400 border-green-500/30',
  hover_text: 'bg-green-500/15 text-green-400 border-green-500/30',
  fill_placeholder: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  fill_label: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  select_option: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  assert_url: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  assert_visible: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  assert_not_visible: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  assert_value: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  assert_api_response: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  wait_ms: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  wait_selector: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  screenshot: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  press_key: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  handle_dialog: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  upload_file: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  drag_drop: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  click_new_tab: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
}

function nodeSummary(d: FlowNodeData): string {
  if (d.type === 'navigate') return d.url ?? ''
  if (d.type === 'click_text' || d.type === 'hover_text' || d.type === 'assert_visible' || d.type === 'assert_not_visible' || d.type === 'wait_selector') return d.text ?? ''
  if (d.type === 'click_role') return d.roleName ? `${d.role}: ${d.roleName}` : d.role ?? ''
  if (d.type === 'click_placeholder' || d.type === 'fill_placeholder' || d.type === 'assert_value') return d.placeholder ?? ''
  if (d.type === 'fill_label' || d.type === 'select_option') return d.labelText ?? ''
  if (d.type === 'click_title') return d.title ?? ''
  if (d.type === 'assert_url') return d.pattern ? `/${d.pattern}/` : ''
  if (d.type === 'assert_api_response') return d.apiExpectedStatus != null ? `${d.apiUrlPattern ?? ''} → ${d.apiExpectedStatus}` : d.apiUrlPattern ?? ''
  if (d.type === 'wait_ms') return d.ms != null ? `${d.ms}ms` : ''
  if (d.type === 'screenshot') return d.screenshotName ?? ''
  if (d.type === 'press_key') return d.key ?? ''
  if (d.type === 'handle_dialog') return d.dialogAction ?? 'accept'
  if (d.type === 'upload_file') return d.filePath ?? ''
  if (d.type === 'drag_drop') return d.text && d.targetSelector ? `${d.text} → ${d.targetSelector}` : d.text ?? d.targetSelector ?? ''
  if (d.type === 'click_new_tab') return d.text ?? ''
  return ''
}

export default function ActionNode({ data, selected }: NodeProps) {
  const t = useTranslations('flows')
  const nodeData = data as unknown as FlowNodeData
  const colorCls = CATEGORY_COLORS[nodeData.type] ?? 'bg-th-surface text-th-fg border-th-border'
  const summary = nodeSummary(nodeData)

  return (
    <div
      className={cn(
        'rounded-lg border bg-th-surface shadow-md transition-shadow min-w-[160px] max-w-[220px]',
        selected ? 'border-th-accent ring-1 ring-th-accent shadow-lg' : 'border-th-border'
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-th-border" />

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase border', colorCls)}>
            {t(`palette.${nodeData.type}`)}
          </span>
        </div>
        <p className="text-xs font-medium text-th-fg truncate">{nodeData.label || t('properties.untitled')}</p>
        {summary && (
          <p className="mt-0.5 text-[10px] text-th-fg-subtle font-mono truncate">{summary}</p>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-th-accent" />
    </div>
  )
}
