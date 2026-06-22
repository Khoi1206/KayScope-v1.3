'use client'

import { useState } from 'react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useFlowStore } from '@/store/flow.store'
import type { FlowBrowser } from '@/db/schema'
import { cn } from '@/components/ui/cn'

interface Props {
  flowId: string
  currentBrowsers: FlowBrowser[]
  onClose: () => void
}

const BROWSERS: { value: FlowBrowser; label: string }[] = [
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'webkit', label: 'WebKit' },
]

export default function FlowSettingsModal({ flowId, currentBrowsers, onClose }: Props) {
  const { updateFlow } = useFlowStore()
  const [browsers, setBrowsers] = useState<FlowBrowser[]>(currentBrowsers)
  const [saving, setSaving] = useState(false)

  useEscapeKey(onClose)

  function toggleBrowser(value: FlowBrowser) {
    setBrowsers(prev =>
      prev.includes(value)
        ? prev.length > 1 ? prev.filter(b => b !== value) : prev // keep at least one selected
        : [...prev, value]
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateFlow(flowId, { browsers })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">Flow Settings</p>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-medium text-th-fg-muted">Browsers</label>
          <div className="flex gap-2">
            {BROWSERS.map(b => {
              const checked = browsers.includes(b.value)
              return (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => toggleBrowser(b.value)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    checked
                      ? 'border-th-accent bg-th-accent/10 text-th-accent'
                      : 'border-th-border bg-th-input text-th-fg-muted hover:border-th-accent/50 hover:text-th-fg'
                  )}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-th-fg-subtle">Run Flow and Test UI will run against every selected browser.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
