'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  flowId: string
  onClose: () => void
}

/**
 * Embeds Playwright's "Test UI" (--ui-host/--ui-port web server mode) same-origin
 * via the /flow-ui-proxy/:flowId reverse proxy in server.ts — gives the same
 * live timeline/actions/DOM-snapshot/network/console/watch-mode experience as
 * `--ui` without an Electron/Chrome-app window, so it works on a headless
 * server and stays inside our own page instead of a separate tab.
 */
export default function FlowUiModal({ flowId, onClose }: Props) {
  const t = useTranslations('flows')
  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-7xl flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-4 py-2">
          <p className="text-sm font-semibold text-th-fg">{t('toolbar.testUi')}</p>
          <button onClick={onClose} className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>
        <iframe src={`/flow-ui-proxy/${flowId}/`} className="flex-1 rounded-b-xl bg-white" title="Playwright Test UI" />
      </div>
    </div>
  )
}
