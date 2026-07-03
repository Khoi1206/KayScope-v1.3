'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useFlowStore } from '@/store/flow.store'
import { useEnvironmentStore } from '@/store/environment.store'
import type { FlowBrowser } from '@/db/schema'
import { cn } from '@/components/ui/cn'

interface Props {
  flowId: string
  currentBrowsers: FlowBrowser[]
  currentEnvironmentId?: string | null
  currentTimeoutMs: number
  onClose: () => void
}

const MIN_TIMEOUT_SEC = 5
const MAX_TIMEOUT_SEC = 600

const BROWSERS: { value: FlowBrowser; label: string }[] = [
  { value: 'chromium', label: 'Chromium' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'webkit', label: 'WebKit' },
]

export default function FlowSettingsModal({ flowId, currentBrowsers, currentEnvironmentId, currentTimeoutMs, onClose }: Props) {
  const t = useTranslations('flows')
  const { updateFlow } = useFlowStore()
  const environments = useEnvironmentStore(s => s.environments)
  const [browsers, setBrowsers] = useState<FlowBrowser[]>(currentBrowsers)
  const [environmentId, setEnvironmentId] = useState<string | null>(currentEnvironmentId ?? null)
  const [timeoutSec, setTimeoutSec] = useState(Math.round(currentTimeoutMs / 1000))
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
      const clampedSec = Math.min(MAX_TIMEOUT_SEC, Math.max(MIN_TIMEOUT_SEC, timeoutSec || MIN_TIMEOUT_SEC))
      await updateFlow(flowId, { browsers, environmentId, timeoutMs: clampedSec * 1000 })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">{t('settings.title')}</p>
        </div>
        <div className="px-5 py-4">
          <label className="mb-1.5 block text-xs font-medium text-th-fg-muted">{t('settings.browsers')}</label>
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
          <p className="mt-2 text-xs text-th-fg-subtle">{t('settings.browsersHint')}</p>

          <label className="mb-1.5 mt-4 block text-xs font-medium text-th-fg-muted">{t('settings.environment')}</label>
          <select
            className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
            value={environmentId ?? ''}
            onChange={e => setEnvironmentId(e.target.value || null)}
          >
            <option value="">{t('settings.environmentNone')}</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-th-fg-subtle">
            {t('settings.environmentHint', { tokenExample: '{{variable}}' })}
          </p>

          <label className="mb-1.5 mt-4 block text-xs font-medium text-th-fg-muted">{t('settings.timeout')}</label>
          <input
            type="number"
            min={MIN_TIMEOUT_SEC}
            max={MAX_TIMEOUT_SEC}
            value={timeoutSec}
            onChange={e => setTimeoutSec(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-md border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
          />
          <p className="mt-2 text-xs text-th-fg-subtle">
            {t('settings.timeoutHint', { min: MIN_TIMEOUT_SEC, max: MAX_TIMEOUT_SEC })}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
