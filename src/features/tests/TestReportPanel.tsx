'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTestSuiteStore, type TestSuiteItem, type TestRunSummaryItem } from '@/store/test-suite.store'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore } from '@/store/environment.store'
import TestSuiteRunsTable from './TestSuiteRunsTable'
import TestRunResultsModal from './TestRunResultsModal'
import type { RunnerResult, RunnerSummary } from '@/lib/execute/runner'
import type { IterationResult } from '@/lib/execute/runner'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  suite: TestSuiteItem
  onClose: () => void
}

export default function TestReportPanel({ suite, onClose }: Props) {
  const { recentRuns, fetchRecentRuns } = useTestSuiteStore()
  const { collections } = useCollectionStore()
  const { environments } = useEnvironmentStore()

  const [viewingRun, setViewingRun] = useState<TestRunSummaryItem | null>(null)
  const [viewingRunFull, setViewingRunFull] = useState<{ result: RunnerResult; record: TestRunSummaryItem } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Nested TestRunResultsModal handles its own Escape — only close this panel when no detail modal is open
  useEscapeKey(() => { if (!viewingRun && !viewingRunFull) onClose() })

  const runs = recentRuns[suite.id] ?? []
  const collectionName = collections.find(c => c.id === suite.collectionId)?.name ?? suite.collectionId
  const environmentName = environments.find(e => e.id === suite.environmentId)?.name ?? null

  useEffect(() => {
    fetchRecentRuns(suite.id)
  }, [suite.id, fetchRecentRuns])

  async function handleViewRun(run: TestRunSummaryItem) {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/test-runs/${run.id}`)
      const data = await res.json()
      if (data.error) return
      const result: RunnerResult = {
        collectionId: data.collectionId,
        collectionName: data.collectionName,
        iterations: (data.iterations ?? []) as IterationResult[],
        summary: data.summary as RunnerSummary,
      }
      setViewingRunFull({ result, record: run })
    } catch {
      // Fallback: open without full iterations (run.id will trigger fetch in modal)
      setViewingRun(run)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Aggregate stats
  const completedRuns = runs.filter(r => r.status !== 'running')
  const passedRuns = completedRuns.filter(r => r.status === 'passed').length
  const passRate = completedRuns.length > 0
    ? Math.round((passedRuns / completedRuns.length) * 100)
    : null
  const avgDuration = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((sum, r) => sum + r.summary.totalDurationMs, 0) / completedRuns.length)
    : null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
            <div>
              <p className="text-xs text-th-fg-muted">Test Run History</p>
              <p className="text-sm font-semibold text-th-fg">{suite.name}</p>
              <p className="text-xs text-th-fg-subtle">
                {collectionName}
                {environmentName && <> · {environmentName}</>}
              </p>
            </div>
            <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
              <X size={15} />
            </button>
          </div>

          {/* Aggregate summary */}
          {completedRuns.length > 0 && (
            <div className="shrink-0 border-b border-th-border bg-th-surface px-5 py-3">
              <p className="text-xs text-th-fg-muted">
                Last {completedRuns.length} run{completedRuns.length !== 1 ? 's' : ''}&nbsp;·&nbsp;
                <span className="text-green-400">{passedRuns} passed</span>&nbsp;·&nbsp;
                <span className={completedRuns.length - passedRuns > 0 ? 'text-red-400' : 'text-th-fg-muted'}>
                  {completedRuns.length - passedRuns} failed
                </span>
                {passRate !== null && <>&nbsp;·&nbsp;<span className="text-th-fg">Pass rate: {passRate}%</span></>}
                {avgDuration !== null && <>&nbsp;·&nbsp;<span className="text-th-fg-muted">Avg: {avgDuration} ms</span></>}
              </p>
            </div>
          )}

          {/* Runs table */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loadingDetail && (
              <p className="mb-2 text-xs text-th-fg-muted">Loading run details…</p>
            )}
            <TestSuiteRunsTable runs={runs} onViewRun={handleViewRun} />
          </div>
        </div>
      </div>

      {/* Detail modal for a selected historical run */}
      {viewingRunFull && (
        <TestRunResultsModal
          suiteName={suite.name}
          result={viewingRunFull.result}
          record={viewingRunFull.record}
          onClose={() => setViewingRunFull(null)}
        />
      )}
      {viewingRun && !viewingRunFull && (
        <TestRunResultsModal
          suiteName={suite.name}
          runId={viewingRun.id}
          record={viewingRun}
          onClose={() => setViewingRun(null)}
        />
      )}
    </>
  )
}
