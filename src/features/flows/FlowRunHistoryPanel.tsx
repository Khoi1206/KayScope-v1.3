'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useFlowStore, type FlowItem, type FlowRunSummaryItem } from '@/store/flow.store'
import type { PlaywrightRunResult } from '@/db/schema'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import FlowResultsPanel from './FlowResultsPanel'

interface Props {
  flow: FlowItem
  onClose: () => void
}

export default function FlowRunHistoryPanel({ flow, onClose }: Props) {
  const { recentRuns, fetchRecentRuns } = useFlowStore()
  const runs = recentRuns[flow.id] ?? []

  const [viewingRun, setViewingRun] = useState<{ result: PlaywrightRunResult; record: FlowRunSummaryItem } | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEscapeKey(() => { viewingRun ? setViewingRun(null) : onClose() })

  useEffect(() => { fetchRecentRuns(flow.id) }, [flow.id, fetchRecentRuns])

  async function handleView(run: FlowRunSummaryItem) {
    setLoadingId(run.id)
    try {
      const res = await fetch(`/api/flow-runs/${run.id}`)
      const data = await res.json()
      if (!data.error && data.testResults) {
        setViewingRun({ result: data.testResults as PlaywrightRunResult, record: run })
      }
    } finally {
      setLoadingId(null)
    }
  }

  const completedRuns = runs.filter(r => r.status !== 'running')
  const passedCount = completedRuns.filter(r => r.status === 'passed').length
  const passRate = completedRuns.length > 0 ? Math.round((passedCount / completedRuns.length) * 100) : null
  const avgDuration = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((s, r) => s + r.summary.duration, 0) / completedRuns.length)
    : null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="flex h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
            <div>
              <p className="text-xs text-th-fg-muted">Flow Run History</p>
              <p className="text-sm font-semibold text-th-fg">{flow.name}</p>
            </div>
            <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
              <X size={15} />
            </button>
          </div>

          {completedRuns.length > 0 && (
            <div className="shrink-0 border-b border-th-border bg-th-surface px-5 py-2">
              <p className="text-xs text-th-fg-muted">
                {completedRuns.length} run{completedRuns.length !== 1 ? 's' : ''}
                &nbsp;·&nbsp;<span className="text-green-400">{passedCount} passed</span>
                &nbsp;·&nbsp;<span className={completedRuns.length - passedCount > 0 ? 'text-red-400' : 'text-th-fg-muted'}>{completedRuns.length - passedCount} failed</span>
                {passRate !== null && <>&nbsp;·&nbsp;Pass rate: {passRate}%</>}
                {avgDuration !== null && <>&nbsp;·&nbsp;Avg: {avgDuration}ms</>}
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {runs.length === 0 ? (
              <p className="text-xs text-th-fg-subtle">No runs yet. Click Run in the flow editor to execute this flow.</p>
            ) : (
              <div className="rounded-md border border-th-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-th-surface text-th-fg-muted">
                      <th className="px-3 py-2 text-left font-medium">Run</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Passed</th>
                      <th className="px-3 py-2 text-right font-medium">Failed</th>
                      <th className="px-3 py-2 text-right font-medium">Duration</th>
                      <th className="px-3 py-2 text-left font-medium">Run at</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run, i) => (
                      <tr key={run.id} className="border-t border-th-border/50 hover:bg-th-surface-hover">
                        <td className="px-3 py-2 font-mono text-th-fg-muted">#{runs.length - i}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                            run.status === 'passed' && 'bg-green-500/15 text-green-400',
                            run.status === 'failed' && 'bg-red-500/15 text-red-400',
                            run.status === 'errored' && 'bg-yellow-500/15 text-yellow-400',
                            run.status === 'running' && 'bg-th-surface text-th-fg-muted',
                          )}>
                            {run.status === 'passed' ? 'Passed' : run.status === 'failed' ? 'Failed' : run.status === 'errored' ? 'Error' : 'Running'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-green-400">{run.summary.passed}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={run.summary.failed > 0 ? 'text-red-400' : 'text-th-fg-muted'}>{run.summary.failed}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-th-fg-muted">{run.summary.duration}ms</td>
                        <td className="px-3 py-2 text-th-fg-muted">{new Date(run.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleView(run)}
                            disabled={loadingId === run.id}
                            className="rounded px-2 py-0.5 text-th-accent hover:underline disabled:opacity-50"
                          >
                            {loadingId === run.id ? '…' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal for a specific run */}
      {viewingRun && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
              <p className="text-sm font-semibold text-th-fg">{flow.name} — Run Details</p>
              <button onClick={() => setViewingRun(null)} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <FlowResultsPanel
                result={viewingRun.result}
                onClose={() => setViewingRun(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
