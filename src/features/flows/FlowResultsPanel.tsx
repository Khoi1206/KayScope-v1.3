'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import type { PlaywrightRunResult } from '@/db/schema'

interface Props {
  result: PlaywrightRunResult
  runError?: string | null
  onClose: () => void
}

export default function FlowResultsPanel({ result, runError, onClose }: Props) {
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
          {overallPassed ? '✅ PASSED' : '❌ FAILED'}
        </span>
        <span className="text-green-400">{summary.passed}/{summary.total} passed</span>
        {summary.failed > 0 && <span className="text-red-400">{summary.failed} failed</span>}
        {summary.skipped > 0 && <span className="text-th-fg-muted">{summary.skipped} skipped</span>}
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
        {tests.map((t, i) => (
          <TestRow key={i} test={t} />
        ))}

        {tests.length === 0 && !runError && (
          <p className="px-4 py-3 text-xs text-th-fg-subtle">No test results.</p>
        )}

        {/* Raw output */}
        {rawOutput && (
          <div className="border-t border-th-border/50 px-4 py-2">
            <button
              onClick={() => setShowRaw(v => !v)}
              className="flex items-center gap-1.5 text-xs text-th-fg-muted hover:text-th-fg"
            >
              {showRaw ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Raw output
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

function TestRow({ test }: { test: PlaywrightRunResult['tests'][number] }) {
  const [open, setOpen] = useState(false)
  const isPassed = test.status === 'passed'

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
        <span className="text-th-fg-subtle">{test.duration}ms</span>
      </button>
      {open && test.error && (
        <div className="px-8 pb-3">
          <p className="rounded bg-red-500/10 px-2 py-1.5 font-mono text-[11px] text-red-400 whitespace-pre-wrap">
            {test.error}
          </p>
        </div>
      )}
    </div>
  )
}
