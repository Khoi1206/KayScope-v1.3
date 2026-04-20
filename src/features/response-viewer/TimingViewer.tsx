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
    <div className="px-4 py-4 text-xs">
      <div className="flex flex-col gap-2">
        <TimingRow label="Status" value={response.status > 0 ? `${response.status} ${response.statusText}` : 'Error'} />
        <TimingRow label="Response size" value={formatSize(response.size)} />
        <div className="flex items-center justify-between">
          <span className="text-th-fg-muted">Duration</span>
          <span className="flex items-center gap-2 font-mono font-medium">
            <span className="text-th-fg">{response.durationMs} ms</span>
            <span className={color}>{label}</span>
          </span>
        </div>
      </div>

      {response.durationMs > 0 && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-th-surface-hover">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-th-fg-subtle">
            <span>0 ms</span>
            <span>5000 ms</span>
          </div>
        </div>
      )}
    </div>
  )
}

function TimingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-th-fg-muted">{label}</span>
      <span className="font-mono font-medium text-th-fg">{value}</span>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
