'use client'

import { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import type { IterationResult, RequestRunResult, RunnerResult, RunnerSummary } from '@/lib/execute/runner'
import type { TestRunSummaryItem } from '@/store/test-suite.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  suiteName: string
  // For live runs, result is passed directly
  result?: RunnerResult | null
  record?: TestRunSummaryItem | null
  // For historical runs, pass only the runId and we fetch it
  runId?: string | null
  onClose: () => void
}

export default function TestRunResultsModal({ suiteName, result: initialResult, record, runId, onClose }: Props) {
  useEscapeKey(onClose)
  const [result, setResult] = useState<RunnerResult | null>(initialResult ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult)
      return
    }
    if (!runId) return
    setLoading(true)
    fetch(`/api/test-runs/${runId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        // DB stores iterations and summary separately; reconstruct RunnerResult shape
        setResult({
          collectionId: data.collectionId,
          collectionName: data.collectionName,
          iterations: (data.iterations ?? []) as IterationResult[],
          summary: data.summary as RunnerSummary,
        })
      })
      .catch(() => setError('Failed to load run details'))
      .finally(() => setLoading(false))
  }, [runId, initialResult])

  const statusBadgeClass = (status: string) => {
    if (status === 'passed') return 'bg-green-500/15 text-green-400'
    if (status === 'errored') return 'bg-yellow-500/15 text-yellow-400'
    return 'bg-red-500/15 text-red-400'
  }

  const statusLabel = (status: string) => {
    if (status === 'passed') return 'Passed'
    if (status === 'failed') return 'Failed'
    if (status === 'errored') return 'Error'
    return 'Running'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
          <div>
            <p className="text-xs text-th-fg-muted">Test Run Results</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-th-fg">{suiteName}</p>
              {record && (
                <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', statusBadgeClass(record.status))}>
                  {statusLabel(record.status)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-full items-center justify-center text-sm text-th-fg-muted">
              Loading run details…
            </div>
          )}
          {error && (
            <div className="px-5 py-6">
              <p className="rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
            </div>
          )}
          {result && !loading && <RunResults result={result} />}
          {!result && !loading && !error && (
            <div className="flex h-full items-center justify-center text-sm text-th-fg-subtle">
              No results available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Results display (mirrors CollectionRunnerModal pattern) ──────────────────

function RunResults({ result }: { result: RunnerResult }) {
  const { summary, iterations } = result
  const multiIter = iterations.length > 1

  return (
    <div className="flex flex-col">
      {/* Summary bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-th-border bg-th-surface px-5 py-3 text-xs">
        <span className="font-semibold text-th-fg">{result.collectionName}</span>
        <span className="text-th-fg-muted">{summary.totalIterations} iteration{summary.totalIterations !== 1 ? 's' : ''}</span>
        <span className="text-th-fg-muted">·</span>
        <span className="text-green-400">{summary.passed} passed</span>
        {summary.failed > 0 && <><span className="text-th-fg-muted">·</span><span className="text-red-400">{summary.failed} failed</span></>}
        {summary.errored > 0 && <><span className="text-th-fg-muted">·</span><span className="text-yellow-400">{summary.errored} errors</span></>}
        <span className="ml-auto text-th-fg-muted">{summary.totalDurationMs} ms total</span>
      </div>

      {iterations.map(iter => (
        <IterationBlock key={iter.iteration} iter={iter} showHeader={multiIter} />
      ))}
    </div>
  )
}

function IterationBlock({ iter, showHeader }: { iter: IterationResult; showHeader: boolean }) {
  const [open, setOpen] = useState(true)
  const passCount = iter.results.reduce((n, r) => n + r.tests.filter(t => t.passed).length, 0)
  const failCount = iter.results.reduce((n, r) => n + r.tests.filter(t => !t.passed).length, 0)

  return (
    <div className="border-b border-th-border">
      {showHeader && (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-xs hover:bg-th-surface-hover"
        >
          {open ? <ChevronDown size={12} className="text-th-fg-muted" /> : <ChevronRight size={12} className="text-th-fg-muted" />}
          <span className="font-semibold text-th-fg">Iteration {iter.iteration}</span>
          {Object.keys(iter.dataRow).length > 0 && (
            <span className="text-th-fg-subtle">
              {Object.entries(iter.dataRow).map(([k, v]) => `${k}=${v}`).join(', ')}
            </span>
          )}
          <span className="ml-auto text-green-400">{passCount}✓</span>
          {failCount > 0 && <span className="ml-1 text-red-400">{failCount}✗</span>}
        </button>
      )}
      {open && (
        <div className="flex flex-col">
          {iter.results.map(r => (
            <RequestResultRow key={r.requestId} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestResultRow({ result: r }: { result: RequestRunResult }) {
  const [open, setOpen] = useState(false)
  const passCount = r.tests.filter(t => t.passed).length
  const failCount = r.tests.filter(t => !t.passed).length
  const isError = !!(r.error || r.preScriptError)

  return (
    <div className="border-t border-th-border/50 first:border-t-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2.5 px-5 py-2 text-left text-xs hover:bg-th-surface-hover"
      >
        {open ? <ChevronDown size={11} className="shrink-0 text-th-fg-muted" /> : <ChevronRight size={11} className="shrink-0 text-th-fg-muted" />}
        <span className={cn('w-14 shrink-0 font-mono font-bold uppercase', methodColor(r.method))}>{r.method}</span>
        <span className="flex-1 truncate text-th-fg">{r.name}</span>
        {isError ? (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-400">Error</span>
        ) : r.status ? (
          <span className={cn('rounded px-1.5 py-0.5 font-mono font-bold tabular-nums', statusBadgeColor(r.status))}>{r.status}</span>
        ) : null}
        {r.durationMs != null && !isError && (
          <span className="text-th-fg-subtle">{r.durationMs}ms</span>
        )}
        {r.tests.length > 0 && (
          <>
            <span className="text-green-400">{passCount}✓</span>
            {failCount > 0 && <span className="text-red-400">{failCount}✗</span>}
          </>
        )}
      </button>
      {open && (
        <div className="px-8 pb-3 pt-1">
          {r.resolvedUrl && <p className="mb-2 truncate font-mono text-xs text-th-fg-muted">{r.resolvedUrl}</p>}
          {r.error && <p className="mb-2 text-xs text-red-400">Error: {r.error}</p>}
          {r.preScriptError && <p className="mb-2 text-xs text-red-400">Pre-script: {r.preScriptError}</p>}
          {r.postScriptError && <p className="mb-2 text-xs text-yellow-400">Post-script: {r.postScriptError}</p>}
          {r.tests.length > 0 && (
            <div className="mb-2 flex flex-col gap-1">
              {r.tests.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={cn('shrink-0 font-bold', t.passed ? 'text-green-400' : 'text-red-400')}>
                    {t.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-th-fg">{t.name}</span>
                  {t.error && <span className="truncate text-red-400 opacity-70">{t.error}</span>}
                </div>
              ))}
            </div>
          )}
          {(r.logs?.length ?? 0) > 0 && (
            <div className="rounded bg-th-surface px-3 py-2">
              {r.logs!.map((l, i) => (
                <p key={i} className="font-mono text-[11px] text-th-fg-muted">{l}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function methodColor(method: string) {
  const map: Record<string, string> = {
    GET: 'text-green-500', POST: 'text-blue-400', PUT: 'text-yellow-400',
    PATCH: 'text-orange-400', DELETE: 'text-red-400',
  }
  return map[method] ?? 'text-th-fg-muted'
}

function statusBadgeColor(status: number) {
  if (status < 300) return 'bg-green-500/15 text-green-400'
  if (status < 400) return 'bg-yellow-500/15 text-yellow-400'
  return 'bg-red-500/15 text-red-400'
}
