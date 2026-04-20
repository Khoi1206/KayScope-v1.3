'use client'

import type { ResponseData } from '@/store/request.store'

interface Props {
  response: ResponseData
}

export default function TimingViewer({ response }: Props) {
  return (
    <div className="px-4 py-4">
      <div className="flex flex-col gap-2 text-xs">
        <TimingRow label="Total duration" value={`${response.durationMs}ms`} />
        <TimingRow label="Status" value={response.status > 0 ? `${response.status} ${response.statusText}` : 'Error'} />
        <TimingRow label="Response size" value={formatSize(response.size)} />
      </div>

      {/* Visual bar */}
      {response.durationMs > 0 && (
        <div className="mt-4">
          <div className="h-3 rounded-full bg-th-surface-hover overflow-hidden">
            <div
              className="h-full rounded-full bg-th-accent"
              style={{ width: `${Math.min(100, (response.durationMs / 10000) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-th-fg-muted">{response.durationMs}ms total</p>
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
