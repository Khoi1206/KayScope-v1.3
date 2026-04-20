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

function statusColor(status: number) {
  if (status === 0) return 'text-th-fg-muted'
  if (status < 200) return 'text-blue-500'
  if (status < 300) return 'text-green-500'
  if (status < 400) return 'text-yellow-500'
  return 'text-red-500'
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
      <div className="flex items-center gap-4 border-b border-th-border px-4 py-2 text-xs">
        {response.status > 0 && (
          <>
            <span className={cn('font-semibold', statusColor(response.status))}>
              {response.status} {response.statusText}
            </span>
            <span className="text-th-fg-muted">{response.durationMs}ms</span>
            <span className="text-th-fg-muted">{formatSize(response.size)}</span>
          </>
        )}
        {response.status === 0 && (
          <span className="text-th-error">{t('error')}: {response.statusText}</span>
        )}

        {/* Pre/post script errors */}
        {response.preScriptError && (
          <span className="text-red-400" title={response.preScriptError}>⚠ Pre-script error</span>
        )}
        {response.postScriptError && (
          <span className="text-yellow-400" title={response.postScriptError}>⚠ Post-script error</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-th-border bg-th-surface px-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3 py-2 text-xs',
              tab === key
                ? 'border-b-2 border-th-accent text-th-fg'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {label}
          </button>
        ))}
        {/* Test results badge */}
        {response.tests && response.tests.length > 0 && (
          <span className="ml-auto flex items-center gap-1 px-2 text-xs">
            <span className="text-green-500">{response.tests.filter(t => t.passed).length}✓</span>
            {response.tests.some(t => !t.passed) && (
              <span className="text-red-400">{response.tests.filter(t => !t.passed).length}✗</span>
            )}
          </span>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'pretty' && <PrettyViewer body={response.body} contentType={contentType} />}
        {tab === 'raw' && <RawViewer body={response.body} />}
        {tab === 'headers' && <HeadersViewer headers={response.headers} />}
        {tab === 'timing' && <TimingViewer response={response} />}
      </div>

      {/* Tests + logs (collapsed footer) */}
      {response.tests && response.tests.length > 0 && (
        <div className="border-t border-th-border bg-th-surface px-4 py-2">
          <p className="mb-1 text-xs font-semibold text-th-fg-muted">Tests</p>
          {response.tests.map((test, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={test.passed ? 'text-green-500' : 'text-red-400'}>
                {test.passed ? '✓' : '✗'}
              </span>
              <span className="text-th-fg">{test.name}</span>
              {test.error && <span className="text-red-400 truncate">{test.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
