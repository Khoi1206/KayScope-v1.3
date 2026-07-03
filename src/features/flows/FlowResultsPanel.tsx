'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, ChevronDown, ChevronRight, Image as ImageIcon, Video, FileArchive } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import type { PlaywrightRunResult } from '@/db/schema'

interface Props {
  result: PlaywrightRunResult
  runError?: string | null
  onClose: () => void
  /** Needed to build artifact URLs (screenshot/video links) — omitted results in no attachment links. */
  runId?: string
}

export default function FlowResultsPanel({ result, runError, onClose, runId }: Props) {
  const t = useTranslations('flows')
  const { summary, tests, rawOutput } = result
  const [showRaw, setShowRaw] = useState(false)

  const overallPassed = result.success

  return (
    <div className="flex flex-col border-t border-th-border bg-th-bg overflow-hidden" style={{ height: '40%' }}>
      {/* Summary bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-th-border bg-th-surface px-4 py-2 text-xs">
        <span
          className={cn(
            'rounded px-2 py-0.5 font-semibold',
            overallPassed ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
          )}
        >
          {overallPassed ? `✅ ${t('results.passed').toUpperCase()}` : `❌ ${t('results.failed').toUpperCase()}`}
        </span>
        <span className="text-green-400">{summary.passed}/{summary.total} {t('results.passed').toLowerCase()}</span>
        {summary.failed > 0 && <span className="text-red-400">{summary.failed} {t('results.failed').toLowerCase()}</span>}
        {summary.skipped > 0 && <span className="text-th-fg-muted">{summary.skipped} {t('results.skipped').toLowerCase()}</span>}
        <span className="ml-auto text-th-fg-muted">{summary.duration}ms</span>
        <button onClick={onClose} className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {runError && (
          <div className="px-4 py-3">
            <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">{runError}</p>
          </div>
        )}

        {/* Per-test rows */}
        {tests.map((test, i) => (
          <TestRow key={i} test={test} runId={runId} />
        ))}

        {tests.length === 0 && !runError && (
          <p className="px-4 py-3 text-xs text-th-fg-subtle">{t('results.noResults')}</p>
        )}

        {/* Raw output */}
        {rawOutput && (
          <div className="border-t border-th-border/50 px-4 py-2">
            <button
              onClick={() => setShowRaw(v => !v)}
              className="flex items-center gap-1.5 text-xs text-th-fg-muted hover:text-th-fg"
            >
              {showRaw ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              {t('results.rawOutput')}
            </button>
            {showRaw && (
              <pre className="mt-2 rounded bg-th-surface px-3 py-2 text-[11px] text-th-fg-muted overflow-x-auto whitespace-pre-wrap">
                {rawOutput}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** image/video get a dedicated icon; everything else (trace .zip, etc.) falls back to a generic file icon. */
function attachmentIcon(contentType: string, size: number) {
  if (contentType.startsWith('image/')) return <ImageIcon size={size} />
  if (contentType.startsWith('video/')) return <Video size={size} />
  return <FileArchive size={size} />
}

function TestRow({ test, runId }: { test: PlaywrightRunResult['tests'][number]; runId?: string }) {
  const [open, setOpen] = useState(false)
  const isPassed = test.status === 'passed'
  const attachments = test.attachments ?? []

  return (
    <div className="border-t border-th-border/50 first:border-t-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs hover:bg-th-surface-hover"
      >
        {open ? <ChevronDown size={11} className="shrink-0 text-th-fg-muted" /> : <ChevronRight size={11} className="shrink-0 text-th-fg-muted" />}
        <span className={cn('shrink-0 font-bold', isPassed ? 'text-green-400' : 'text-red-400')}>
          {isPassed ? '✓' : '✗'}
        </span>
        <span className="flex-1 truncate text-th-fg">{test.testName}</span>
        {attachments.length > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-th-fg-subtle">
            {[...new Set(attachments.map(a => a.contentType))].map(ct => (
              <span key={ct}>{attachmentIcon(ct, 11)}</span>
            ))}
          </span>
        )}
        <span className="text-th-fg-subtle">{test.duration}ms</span>
      </button>
      {open && (test.error || attachments.length > 0) && (
        <div className="px-8 pb-3 space-y-2">
          {test.error && (
            <p className="rounded bg-red-500/10 px-2 py-1.5 font-mono text-[11px] text-red-400 whitespace-pre-wrap">
              {test.error}
            </p>
          )}
          {runId && attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <a
                  key={i}
                  href={`/api/flow-runs/${runId}/artifact?path=${encodeURIComponent(att.relPath)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded border border-th-border bg-th-surface px-2 py-1 text-[11px] text-th-accent hover:bg-th-surface-hover"
                >
                  {attachmentIcon(att.contentType, 11)}
                  {att.name}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
