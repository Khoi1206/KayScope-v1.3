'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { NodeType } from '@/db/schema/flows'

interface Group {
  key: string
  icon: string
  types: NodeType[]
}

const GROUPS: Group[] = [
  { key: 'navigation', icon: '🌐', types: ['navigate'] },
  { key: 'click', icon: '🖱️', types: ['click_text', 'click_role', 'click_placeholder', 'click_title', 'hover_text'] },
  { key: 'fill', icon: '✏️', types: ['fill_placeholder', 'fill_label', 'select_option'] },
  { key: 'assert', icon: '✅', types: ['assert_url', 'assert_visible', 'assert_not_visible', 'assert_value', 'assert_api_response'] },
  { key: 'timing', icon: '⏳', types: ['wait_ms', 'wait_selector'] },
  { key: 'media', icon: '📸', types: ['screenshot'] },
  { key: 'advanced', icon: '🧩', types: ['press_key', 'handle_dialog', 'upload_file', 'drag_drop', 'click_new_tab'] },
]

interface Props {
  onAdd: (type: NodeType, label: string) => void
}

export default function NodePalette({ onAdd }: Props) {
  const t = useTranslations('flows')
  // All groups closed by default
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({}))

  const toggle = (key: string) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="flex h-full w-48 flex-col border-r border-th-border bg-th-surface">
      <div className="shrink-0 px-3 py-2 border-b border-th-border">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">{t('palette.actionsHeader')}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {GROUPS.map(group => {
          const isOpen = open[group.key] ?? false
          return (
            <div key={group.key} className="border-b border-th-border/50 last:border-b-0">
              {/* Group header — click to toggle */}
              <button
                onClick={() => toggle(group.key)}
                className="flex w-full items-center gap-1.5 px-3 py-2 hover:bg-th-surface-hover transition-colors"
              >
                <span className="text-xs">{group.icon}</span>
                <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-th-fg-muted">
                  {t(`palette.${group.key}`)}
                </span>
                {isOpen
                  ? <ChevronDown size={11} className="text-th-fg-subtle shrink-0" />
                  : <ChevronRight size={11} className="text-th-fg-subtle shrink-0" />
                }
              </button>

              {/* Items */}
              {isOpen && (
                <div className="pb-1">
                  {group.types.map(type => (
                    <button
                      key={type}
                      onClick={() => onAdd(type, t(`palette.${type}`))}
                      className="w-full px-5 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover transition-colors"
                    >
                      {t(`palette.${type}`)}
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
