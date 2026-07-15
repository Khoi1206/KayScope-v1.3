'use client'

import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  /** URL of the trace.zip to load — same-origin artifact endpoint, e.g. /api/flow-runs/:id/artifact?path=... */
  traceUrl: string
  onClose: () => void
}

/**
 * Embeds Playwright's static trace viewer SPA (copied into public/trace-viewer
 * by scripts/copy-trace-viewer.mjs) same-origin, so it can fetch the trace.zip
 * via our own authenticated artifact route without CORS/session issues —
 * gives the same step/DOM-snapshot/network/console inspection as `--ui` mode
 * without needing a desktop Electron window or a separate tab.
 */
export default function TraceViewerModal({ traceUrl, onClose }: Props) {
  const t = useTranslations('flows')
  useEscapeKey(onClose)

  const src = `/trace-viewer/index.html?trace=${encodeURIComponent(traceUrl)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-6xl flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-4 py-2">
          <p className="text-sm font-semibold text-th-fg">{t('results.traceViewer')}</p>
          <button onClick={onClose} className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>
        <iframe src={src} className="flex-1 rounded-b-xl bg-white" title="Playwright Trace Viewer" />
      </div>
    </div>
  )
}
