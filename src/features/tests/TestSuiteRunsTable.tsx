'use client'

import { cn } from '@/components/ui/cn'
import type { TestRunSummaryItem } from '@/store/test-suite.store'

interface Props {
  runs: TestRunSummaryItem[]
  onViewRun: (run: TestRunSummaryItem) => void
}

export default function TestSuiteRunsTable({ runs, onViewRun }: Props) {
  if (runs.length === 0) {
    return (
      <p className="py-4 text-xs text-th-fg-subtle">
        No runs yet. Click Run to execute this suite.
      </p>
    )
  }

  return (
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
                <StatusBadge status={run.status} />
              </td>
              <td className="px-3 py-2 text-right text-green-400">{run.summary.passed}</td>
              <td className="px-3 py-2 text-right">
                <span className={run.summary.failed > 0 ? 'text-red-400' : 'text-th-fg-muted'}>
                  {run.summary.failed}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-th-fg-muted">
                {run.summary.totalDurationMs}ms
              </td>
              <td className="px-3 py-2 text-th-fg-muted">
                {new Date(run.createdAt).toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <button
                  onClick={() => onViewRun(run)}
                  className="rounded px-2 py-0.5 text-th-accent hover:bg-th-surface hover:underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = cn(
    'rounded px-1.5 py-0.5 text-[11px] font-semibold',
    status === 'passed' && 'bg-green-500/15 text-green-400',
    status === 'failed' && 'bg-red-500/15 text-red-400',
    status === 'errored' && 'bg-yellow-500/15 text-yellow-400',
    status === 'running' && 'bg-th-surface text-th-fg-muted',
  )
  const label = status === 'passed' ? 'Passed'
    : status === 'failed' ? 'Failed'
    : status === 'errored' ? 'Error'
    : 'Running'
  return <span className={cls}>{label}</span>
}
