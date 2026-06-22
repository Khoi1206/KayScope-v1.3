'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookmarkPlus } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import type { ResponseData } from '@/store/request.store'
import { useRequestStore } from '@/store/request.store'
import { useExampleStore } from '@/store/example.store'
import PrettyViewer from './PrettyViewer'
import RawViewer from './RawViewer'
import HeadersViewer from './HeadersViewer'
import TimingViewer from './TimingViewer'

type ResponseTab = 'pretty' | 'raw' | 'headers' | 'timing' | 'console'

interface Props {
  response: ResponseData
  requestId?: string
  requestName?: string
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

export default function ResponsePanel({ response, requestId, requestName }: Props) {
  const t = useTranslations('response')
  const te = useTranslations('examples')
  const { createExample } = useExampleStore()
  const activeTabId = useRequestStore(s => s.activeTabId)
  const activeSnap = useRequestStore(s => activeTabId ? s.snapshots[activeTabId] : null)
  const [tab, setTab] = useState<ResponseTab>('pretty')
  const [saving, setSaving] = useState(false)

  const hasLogs = (response.logs?.length ?? 0) > 0

  const TABS: { key: ResponseTab; label: string; dot?: boolean }[] = [
    { key: 'pretty', label: t('pretty') },
    { key: 'raw', label: t('raw') },
    { key: 'headers', label: t('headers') },
    { key: 'timing', label: t('timing') },
    { key: 'console', label: t('console'), dot: hasLogs },
  ]

  const contentType = response.headers['content-type'] ?? response.headers['Content-Type'] ?? ''
  const canSave = response.status > 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-th-bg">
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b border-th-border bg-th-surface px-3 py-1 text-xs">
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
          {canSave && (
            <button
              onClick={async () => {
                if (!requestId || saving) return
                setSaving(true)
                try {
                  await createExample(requestId, {
                    name: requestName?.trim() || `${response.status} ${response.statusText}`.trim(),
                    status: response.status || undefined,
                    statusText: response.statusText || undefined,
                    responseHeaders: Object.keys(response.headers).length > 0 ? response.headers : undefined,
                    responseBody: response.body ? response.body.slice(0, 51_200) : undefined,
                    durationMs: response.durationMs || undefined,
                    size: response.size || undefined,
                    requestMethod: activeSnap?.method,
                    requestUrl: activeSnap?.url,
                    requestParams: activeSnap?.params,
                    requestHeaders: activeSnap?.headers,
                    requestBody: activeSnap?.body,
                    requestAuth: activeSnap?.auth,
                  })
                } catch {
                  // silent
                } finally {
                  setSaving(false)
                }
              }}
              disabled={!requestId || saving}
              title={requestId ? te('saveResponse') : te('saveRequestFirst')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors',
                requestId && !saving
                  ? 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
                  : 'cursor-not-allowed text-th-fg-subtle opacity-50'
              )}
            >
              <BookmarkPlus size={12} />
              <span>{saving ? '…' : te('saveResponse')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-th-border bg-th-surface px-3">
        {TABS.map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              tab === key
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {label}
            {dot && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-th-accent align-middle" />}
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
        {tab === 'console' && (
          <div className="p-3 font-mono text-xs">
            {!hasLogs && (
              <p className="text-th-fg-subtle">{t('noLogs')}</p>
            )}
            {response.logs?.map((line, i) => {
              const isWarn = line.startsWith('[warn] ')
              const isError = line.startsWith('[error] ')
              const text = isWarn ? line.slice(7) : isError ? line.slice(8) : line
              return (
                <div key={i} className={cn(
                  'border-b border-th-border/30 py-1 leading-relaxed',
                  isWarn ? 'text-yellow-400' : isError ? 'text-red-400' : 'text-green-400'
                )}>
                  <span className="mr-2 select-none text-th-fg-subtle opacity-50">
                    {isWarn ? '⚠' : isError ? '✖' : '›'}
                  </span>
                  {text}
                </div>
              )
            })}
          </div>
        )}
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
