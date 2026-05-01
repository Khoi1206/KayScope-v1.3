'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { NodeType } from '@/db/schema/flows'

interface PaletteItem {
  type: NodeType
  label: string
}

const GROUPS: { label: string; icon: string; items: PaletteItem[] }[] = [
  {
    label: 'Navigation',
    icon: '🌐',
    items: [{ type: 'navigate', label: 'Navigate' }],
  },
  {
    label: 'Click / Hover',
    icon: '🖱️',
    items: [
      { type: 'click_text', label: 'Click by text' },
      { type: 'click_role', label: 'Click by role' },
      { type: 'click_placeholder', label: 'Click by placeholder' },
      { type: 'click_title', label: 'Click by title' },
      { type: 'hover_text', label: 'Hover by text' },
    ],
  },
  {
    label: 'Fill / Select',
    icon: '✏️',
    items: [
      { type: 'fill_placeholder', label: 'Fill by placeholder' },
      { type: 'fill_label', label: 'Fill by label' },
      { type: 'select_option', label: 'Select option' },
    ],
  },
  {
    label: 'Assert',
    icon: '✅',
    items: [
      { type: 'assert_url', label: 'Assert URL' },
      { type: 'assert_visible', label: 'Assert visible' },
      { type: 'assert_not_visible', label: 'Assert not visible' },
      { type: 'assert_value', label: 'Assert value' },
    ],
  },
  {
    label: 'Timing',
    icon: '⏳',
    items: [
      { type: 'wait_ms', label: 'Wait (ms)' },
      { type: 'wait_selector', label: 'Wait for text' },
    ],
  },
  {
    label: 'Media',
    icon: '📸',
    items: [{ type: 'screenshot', label: 'Screenshot' }],
  },
]

interface Props {
  onAdd: (type: NodeType, label: string) => void
}

export default function NodePalette({ onAdd }: Props) {
  // All groups closed by default
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({}))

  const toggle = (label: string) =>
    setOpen(prev => ({ ...prev, [label]: !prev[label] }))

  return (
    <div className="flex h-full w-48 flex-col border-r border-th-border bg-th-surface">
      <div className="shrink-0 px-3 py-2 border-b border-th-border">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">Actions</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {GROUPS.map(group => {
          const isOpen = open[group.label] ?? false
          return (
            <div key={group.label} className="border-b border-th-border/50 last:border-b-0">
              {/* Group header — click to toggle */}
              <button
                onClick={() => toggle(group.label)}
                className="flex w-full items-center gap-1.5 px-3 py-2 hover:bg-th-surface-hover transition-colors"
              >
                <span className="text-xs">{group.icon}</span>
                <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-th-fg-muted">
                  {group.label}
                </span>
                {isOpen
                  ? <ChevronDown size={11} className="text-th-fg-subtle shrink-0" />
                  : <ChevronRight size={11} className="text-th-fg-subtle shrink-0" />
                }
              </button>

              {/* Items */}
              {isOpen && (
                <div className="pb-1">
                  {group.items.map(item => (
                    <button
                      key={item.type}
                      onClick={() => onAdd(item.type, item.label)}
                      className="w-full px-5 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
