'use client'

import type { ResponseData } from '@/store/request.store'

interface Props {
  response: ResponseData
}

function speedLabel(ms: number) {
  if (ms < 200) return { label: 'Fast', color: 'text-green-500' }
  if (ms < 1000) return { label: 'OK', color: 'text-yellow-500' }
  return { label: 'Slow', color: 'text-red-400' }
}

export default function TimingViewer({ response }: Props) {
  const { label, color } = speedLabel(response.durationMs)
  const barWidth = Math.min(100, (response.durationMs / 5000) * 100)
  const barColor = response.durationMs < 200 ? 'bg-green-500' : response.durationMs < 1000 ? 'bg-yellow-500' : 'bg-red-400'

  return (
    <div className="p-5 text-xs">
      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard
          label="Status"
          value={response.status > 0 ? `${response.status}` : 'Error'}
          sub={response.statusText}
          valueClass={response.status >= 200 && response.status < 300 ? 'text-green-400' : 'text-red-400'}
        />
        <StatCard
          label="Duration"
          value={`${response.durationMs}`}
          sub={`ms · ${label}`}
          valueClass={color}
        />
        <StatCard
          label="Size"
          value={formatSize(response.size)}
          valueClass="text-th-fg"
        />
      </div>

      {response.durationMs > 0 && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-th-surface-hover">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-th-fg-subtle">
            <span>0 ms</span>
            <span>5 000 ms</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass: string }) {
  return (
    <div className="rounded-lg border border-th-border bg-th-surface p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">{label}</p>
      <p className={`font-mono text-base font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-th-fg-muted">{sub}</p>}
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
