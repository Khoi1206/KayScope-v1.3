'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/components/ui/cn'
import type { ResponseData } from '@/store/request.store'
import PrettyViewer from './PrettyViewer'
import RawViewer from './RawViewer'
import HeadersViewer from './HeadersViewer'
import TimingViewer from './TimingViewer'

type ResponseTab = 'pretty' | 'raw' | 'headers' | 'timing'

interface Props {
  response: ResponseData
}

function statusBadgeClass(status: number) {
  if (status === 0) return 'bg-th-border/30 text-th-fg-muted'
  if (status < 200) return 'bg-blue-500/15 text-blue-400'
  if (status < 300) return 'bg-green-500/15 text-green-400'
  if (status < 400) return 'bg-yellow-500/15 text-yellow-400'
  return 'bg-red-500/15 text-red-400'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ResponsePanel({ response }: Props) {
  const t = useTranslations('response')
  const [tab, setTab] = useState<ResponseTab>('pretty')

  const TABS: { key: ResponseTab; label: string }[] = [
    { key: 'pretty', label: t('pretty') },
    { key: 'raw', label: t('raw') },
    { key: 'headers', label: t('headers') },
    { key: 'timing', label: t('timing') },
  ]

  const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? ''

  return (
    <div className="flex h-full flex-col overflow-hidden bg-th-bg">
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b border-th-border bg-th-surface px-4 py-2 text-xs">
        {response.status > 0 && (
          <>
            <span className={cn('rounded-md px-2 py-0.5 font-bold tabular-nums', statusBadgeClass(response.status))}>
              {response.status}
            </span>
            <span className="text-th-fg-muted">{response.statusText}</span>
            <span className="text-th-fg-subtle">·</span>
            <span className="font-mono text-th-fg-muted">{response.durationMs} <span className="text-th-fg-subtle">ms</span></span>
            <span className="text-th-fg-subtle">·</span>
            <span className="font-mono text-th-fg-muted">{formatSize(response.size)}</span>
          </>
        )}
        {response.status === 0 && (
          <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-400">{t('error')}: {response.statusText}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {response.preScriptError && (
            <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-red-400" title={response.preScriptError}>⚠ Pre-script</span>
          )}
          {response.postScriptError && (
            <span className="rounded-md bg-yellow-500/10 px-2 py-0.5 text-yellow-400" title={response.postScriptError}>⚠ Post-script</span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-th-border bg-th-surface px-3">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative px-3 py-2.5 text-xs font-medium transition-colors',
              tab === key
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {label}
          </button>
        ))}
        {/* Test results badge */}
        {response.tests && response.tests.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2 text-xs">
            <span className="rounded-md bg-green-500/15 px-2 py-0.5 font-medium text-green-400">
              {response.tests.filter(t => t.passed).length} ✓
            </span>
            {response.tests.some(t => !t.passed) && (
              <span className="rounded-md bg-red-500/15 px-2 py-0.5 font-medium text-red-400">
                {response.tests.filter(t => !t.passed).length} ✗
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'pretty' && <PrettyViewer body={response.body} contentType={contentType} />}
        {tab === 'raw' && <RawViewer body={response.body} />}
        {tab === 'headers' && <HeadersViewer headers={response.headers} />}
        {tab === 'timing' && <TimingViewer response={response} />}
      </div>

      {/* Tests footer */}
      {response.tests && response.tests.length > 0 && (
        <div className="border-t border-th-border bg-th-surface px-4 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">Tests</p>
          <div className="flex flex-col gap-1">
            {response.tests.map((test, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn('shrink-0 font-bold', test.passed ? 'text-green-400' : 'text-red-400')}>
                  {test.passed ? '✓' : '✗'}
                </span>
                <span className="text-th-fg">{test.name}</span>
                {test.error && <span className="truncate text-red-400 opacity-70">{test.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
