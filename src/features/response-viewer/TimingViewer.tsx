'use client'

import { cn } from '@/components/ui/cn'
import type { ResponseData } from '@/store/request.store'

interface Props {
  response: ResponseData
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function speedConfig(ms: number) {
  if (ms < 200) return { label: 'Fast', color: 'text-green-500', bar: 'bg-green-500' }
  if (ms < 1000) return { label: 'OK', color: 'text-yellow-500', bar: 'bg-yellow-500' }
  return { label: 'Slow', color: 'text-red-400', bar: 'bg-red-400' }
}

function phaseColor(ms: number) {
  if (ms < 100) return 'text-green-400'
  if (ms < 500) return 'text-yellow-400'
  return 'text-red-400'
}

function statusColor(status: number) {
  if (status === 0) return 'text-th-fg-muted'
  if (status < 300) return 'text-green-400'
  if (status < 400) return 'text-yellow-500'
  return 'text-red-500'
}

export default function TimingViewer({ response }: Props) {
  const speed = speedConfig(response.durationMs)
  const barWidth = Math.min(100, (response.durationMs / 5000) * 100)

  const hasRealTiming = response.ttfbMs !== undefined && response.downloadMs !== undefined
  const ttfb = response.ttfbMs ?? Math.round(response.durationMs * 0.75)
  const download = response.downloadMs ?? Math.round(response.durationMs * 0.20)
  const connectionMs = hasRealTiming ? Math.max(0, response.durationMs - ttfb - download) : Math.round(response.durationMs * 0.05)

  const phases = [
    {
      phase: 'Connection',
      ms: connectionMs,
      hint: hasRealTiming ? 'TCP + TLS handshake (from total − TTFB − download)' : 'TCP + TLS handshake (estimated)',
      bar: 'bg-blue-500/60',
    },
    {
      phase: 'Waiting (TTFB)',
      ms: ttfb,
      hint: hasRealTiming ? 'Time to first byte — actual measurement' : 'Time to first byte (estimated)',
      bar: 'bg-orange-500/60',
    },
    {
      phase: 'Content download',
      ms: download,
      hint: hasRealTiming ? `${formatSize(response.size)} downloaded — actual measurement` : `${formatSize(response.size)} received`,
      bar: 'bg-green-500/60',
    },
  ]

  const maxPhaseMs = Math.max(...phases.map(p => p.ms), 1)

  return (
    <div className="p-5 text-xs">
      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          label="Status"
          value={response.status > 0 ? `${response.status}` : 'Error'}
          sub={response.statusText}
          valueClass={statusColor(response.status)}
        />
        <StatCard
          label="Duration"
          value={`${response.durationMs}`}
          sub={`ms · ${speed.label}`}
          valueClass={speed.color}
        />
        <StatCard
          label="Size"
          value={formatSize(response.size)}
          valueClass="text-th-fg"
        />
      </div>

      {response.durationMs > 0 && (
        <>
          {/* Timeline bar */}
          <div className="mb-6">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium">
              <span className="text-th-fg-subtle uppercase tracking-widest">Timeline</span>
              <span className={cn('font-mono font-bold', speed.color)}>{response.durationMs} ms</span>
            </div>
            <div className="relative h-5 overflow-hidden rounded-md bg-th-surface-hover">
              <div className={cn('h-full rounded-md transition-all', speed.bar)} style={{ width: `${barWidth}%` }} />
              <span className="absolute inset-0 flex items-center px-2 font-mono text-[10px] font-semibold text-white mix-blend-overlay">
                {response.durationMs} ms
              </span>
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-th-fg-subtle">
              <span>0 ms</span><span>1 000 ms</span><span>3 000 ms</span><span>5 000 ms</span>
            </div>
          </div>

          {/* Phase breakdown */}
          <div className="rounded-xl border border-th-border overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_auto] border-b border-th-border bg-th-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">
              <span>Phase</span>
              <span>Bar</span>
              <span className="text-right">Duration</span>
            </div>
            {phases.map(({ phase, ms, hint, bar }) => (
              <div key={phase} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 border-b border-th-border/30 px-3 py-2 last:border-0 hover:bg-th-surface-hover">
                <div>
                  <span className="text-th-fg">{phase}</span>
                  {hasRealTiming ? (
                    <span className="ml-2 rounded-md bg-green-500/10 px-1 text-[9px] font-medium text-green-500">actual</span>
                  ) : (
                    <span className="ml-2 rounded-md bg-th-border/40 px-1 text-[9px] text-th-fg-subtle">est.</span>
                  )}
                  <span className="ml-1 text-[10px] text-th-fg-subtle">{hint}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-th-surface-hover">
                  <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.round((ms / maxPhaseMs) * 100)}%` }} />
                </div>
                <span className={cn('font-mono text-[11px] font-medium text-right min-w-[52px]', phaseColor(ms))}>
                  {ms} ms
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_120px_auto] items-center gap-3 bg-th-surface px-3 py-1.5 text-[11px] font-semibold">
              <span className="text-th-fg-muted">Total</span>
              <span />
              <span className={cn('font-mono text-right min-w-[52px]', speed.color)}>{response.durationMs} ms</span>
            </div>
          </div>

          {!hasRealTiming && (
            <p className="mt-2 text-[10px] text-th-fg-subtle italic">
              Phase breakdown is estimated from total duration. Real TTFB/download timing requires the updated server.
            </p>
          )}
        </>
      )}

      {response.durationMs === 0 && (
        <p className="text-th-fg-subtle">No timing data available.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, valueClass }: {
  label: string
  value: string
  sub?: string
  valueClass: string
}) {
  return (
    <div className="rounded-xl border border-th-border bg-th-surface p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">{label}</p>
      <p className={cn('font-mono text-base font-bold', valueClass)}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-th-fg-muted">{sub}</p>}
    </div>
  )
}
