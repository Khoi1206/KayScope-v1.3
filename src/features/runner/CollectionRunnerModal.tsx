'use client'

import { useState, useRef } from 'react'
import { X, Upload, Play, Download, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useRunnerStore } from '@/store/runner.store'
import { useEnvironmentStore } from '@/store/environment.store'
import { parseDataFile, detectFileType, type DataRow } from '@/lib/data-parser'
import { downloadFile } from '@/lib/download'
import { cn } from '@/components/ui/cn'
import type { IterationResult, RequestRunResult } from '@/lib/execute/runner'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  collectionId: string
  collectionName: string
  onClose: () => void
}

export default function CollectionRunnerModal({ collectionId, collectionName, onClose }: Props) {
  useEscapeKey(onClose)
  const { environments, activeEnvironmentId } = useEnvironmentStore()
  const { running, result, error, startRun, reset } = useRunnerStore()

  const [envId, setEnvId] = useState<string>(activeEnvironmentId ?? '')
  const [dataRows, setDataRows] = useState<DataRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = detectFileType(file.name)
    if (!type) { setFileError('Unsupported file type. Use .csv or .json'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      const parsed = parseDataFile(content, type)
      if (parsed.error) { setFileError(parsed.error); return }
      setDataRows(parsed.rows)
      setFileName(file.name)
      setFileError(null)
    }
    reader.readAsText(file)
  }

  function clearFile() {
    setDataRows([])
    setFileName(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRun() {
    reset()
    await startRun(collectionId, collectionName, envId || undefined, dataRows)
  }

  function handleExport(format: 'kayscope' | 'postman' = 'kayscope') {
    const ext = format === 'postman' ? 'postman_collection.json' : 'kayscope.json'
    downloadFile(`/api/collections/${collectionId}/export?format=${format}`, `${collectionName}.${ext}`)
      .catch(err => console.error('Export failed', err))
  }

  const iterCount = dataRows.length > 0 ? dataRows.length : 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
          <div>
            <p className="text-xs text-th-fg-muted">Collection Runner</p>
            <p className="text-sm font-semibold text-th-fg">{collectionName}</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportMenu onExport={handleExport} />
            <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Config panel */}
        {!result && (
          <div className="shrink-0 border-b border-th-border bg-th-surface px-5 py-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Environment */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-th-fg-muted">Environment</label>
                <select
                  value={envId}
                  onChange={e => setEnvId(e.target.value)}
                  className="rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
                >
                  <option value="">No Environment</option>
                  {environments.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>

              {/* Data file */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-th-fg-muted">Data file (CSV / JSON)</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded border border-th-border px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
                  >
                    <Upload size={12} />
                    {fileName ?? 'Upload file'}
                  </button>
                  {fileName && (
                    <button onClick={clearFile} className="text-xs text-th-fg-subtle hover:text-th-fg">
                      <X size={12} />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
                {fileError && <p className="text-xs text-red-400">{fileError}</p>}
              </div>

              {/* Iteration count badge */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-th-fg-muted">Iterations</label>
                <span className="rounded border border-th-border px-3 py-1.5 text-xs font-mono text-th-fg">{iterCount}</span>
              </div>

              {/* Run button */}
              <button
                onClick={handleRun}
                disabled={running}
                className="ml-auto flex items-center gap-1.5 rounded bg-th-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-th-accent-hover disabled:opacity-50"
              >
                <Play size={12} />
                {running ? 'Running…' : 'Run Collection'}
              </button>
            </div>

            {dataRows.length > 0 && (
              <p className="mt-2 text-xs text-th-fg-muted">
                {dataRows.length} data row{dataRows.length > 1 ? 's' : ''} loaded — {Object.keys(dataRows[0]!).join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {running && (
            <div className="flex h-full items-center justify-center text-sm text-th-fg-muted">
              Running collection…
            </div>
          )}

          {error && !running && (
            <div className="px-5 py-6">
              <p className="rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
              <button onClick={reset} className="mt-3 text-xs text-th-fg-muted hover:text-th-fg">← Run again</button>
            </div>
          )}

          {result && !running && (
            <RunResults result={result} onReset={reset} />
          )}

          {!result && !running && !error && (
            <div className="flex h-full items-center justify-center text-sm text-th-fg-subtle">
              Configure above and click Run Collection
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Results ──────────────────────────────────────────────────────────────────

function RunResults({ result, onReset }: { result: import('@/lib/execute/runner').RunnerResult; onReset: () => void }) {
  const { summary, iterations } = result
  const multiIter = iterations.length > 1

  return (
    <div className="flex flex-col gap-0">
      {/* Summary bar */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-th-border bg-th-surface px-5 py-3 text-xs">
        <span className="font-semibold text-th-fg">{result.collectionName}</span>
        <span className="text-th-fg-muted">{summary.totalIterations} iteration{summary.totalIterations > 1 ? 's' : ''}</span>
        <span className="text-th-fg-muted">·</span>
        <span className="text-green-400">{summary.passed} passed</span>
        {summary.failed > 0 && <><span className="text-th-fg-muted">·</span><span className="text-red-400">{summary.failed} failed</span></>}
        {summary.errored > 0 && <><span className="text-th-fg-muted">·</span><span className="text-yellow-400">{summary.errored} errors</span></>}
        <span className="ml-auto text-th-fg-muted">{summary.totalDurationMs} ms total</span>
        <button onClick={onReset} className="rounded px-2 py-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">← Back</button>
      </div>

      {/* Iteration results */}
      {iterations.map(iter => (
        <IterationBlock key={iter.iteration} iter={iter} showHeader={multiIter} />
      ))}
    </div>
  )
}

function IterationBlock({ iter, showHeader }: { iter: IterationResult; showHeader: boolean }) {
  const [open, setOpen] = useState(true)
  const passCount = iter.results.reduce((n, r) => n + r.tests.filter(t => t.passed).length, 0)
  const failCount = iter.results.reduce((n, r) => n + r.tests.filter(t => !t.passed).length, 0)

  return (
    <div className="border-b border-th-border">
      {showHeader && (
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-xs hover:bg-th-surface-hover"
        >
          {open ? <ChevronDown size={12} className="text-th-fg-muted" /> : <ChevronRight size={12} className="text-th-fg-muted" />}
          <span className="font-semibold text-th-fg">Iteration {iter.iteration}</span>
          {Object.keys(iter.dataRow).length > 0 && (
            <span className="text-th-fg-subtle">
              {Object.entries(iter.dataRow).map(([k, v]) => `${k}=${v}`).join(', ')}
            </span>
          )}
          <span className="ml-auto text-green-400">{passCount}✓</span>
          {failCount > 0 && <span className="text-red-400 ml-1">{failCount}✗</span>}
        </button>
      )}

      {open && (
        <div className="flex flex-col">
          {iter.results.map(r => (
            <RequestResultRow key={r.requestId} result={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestResultRow({ result: r }: { result: RequestRunResult }) {
  const [open, setOpen] = useState(false)
  const hasTests = r.tests.length > 0
  const hasLogs = (r.logs?.length ?? 0) > 0
  const isError = !!(r.error || r.preScriptError)

  const passCount = r.tests.filter(t => t.passed).length
  const failCount = r.tests.filter(t => !t.passed).length

  return (
    <div className="border-t border-th-border/50 first:border-t-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-2.5 px-5 py-2 text-left text-xs hover:bg-th-surface-hover"
      >
        {open ? <ChevronDown size={11} className="shrink-0 text-th-fg-muted" /> : <ChevronRight size={11} className="shrink-0 text-th-fg-muted" />}
        <span className={cn('w-14 shrink-0 font-mono font-bold uppercase', methodColor(r.method))}>{r.method}</span>
        <span className="flex-1 truncate text-th-fg">{r.name}</span>
        {isError ? (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-400">Error</span>
        ) : r.status ? (
          <span className={cn('rounded px-1.5 py-0.5 font-mono font-bold tabular-nums', statusBadge(r.status))}>{r.status}</span>
        ) : null}
        {r.durationMs != null && !isError && (
          <span className="text-th-fg-subtle">{r.durationMs}ms</span>
        )}
        {hasTests && (
          <>
            <span className="text-green-400">{passCount}✓</span>
            {failCount > 0 && <span className="text-red-400">{failCount}✗</span>}
          </>
        )}
      </button>

      {open && (
        <div className="px-8 pb-3 pt-1">
          {r.resolvedUrl && (
            <p className="mb-2 truncate font-mono text-xs text-th-fg-muted">{r.resolvedUrl}</p>
          )}
          {r.error && <p className="mb-2 text-xs text-red-400">Error: {r.error}</p>}
          {r.preScriptError && <p className="mb-2 text-xs text-red-400">Pre-script: {r.preScriptError}</p>}
          {r.postScriptError && <p className="mb-2 text-xs text-yellow-400">Post-script: {r.postScriptError}</p>}
          {hasTests && (
            <div className="mb-2 flex flex-col gap-1">
              {r.tests.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={cn('shrink-0 font-bold', t.passed ? 'text-green-400' : 'text-red-400')}>
                    {t.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-th-fg">{t.name}</span>
                  {t.error && <span className="truncate text-red-400 opacity-70">{t.error}</span>}
                </div>
              ))}
            </div>
          )}
          {hasLogs && (
            <div className="rounded bg-th-surface px-3 py-2">
              {r.logs!.map((l, i) => (
                <p key={i} className="font-mono text-[11px] text-th-fg-muted">{l}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExportMenu({ onExport }: { onExport: (format: 'kayscope' | 'postman') => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <Download size={13} />
        Export
        <MoreHorizontal size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-th-border bg-th-bg py-1 shadow-xl">
            <button
              onClick={() => { setOpen(false); onExport('kayscope') }}
              className="w-full px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
            >
              KayScope format (.json)
            </button>
            <button
              onClick={() => { setOpen(false); onExport('postman') }}
              className="w-full px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
            >
              Postman v2.1 format
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function methodColor(method: string) {
  const map: Record<string, string> = {
    GET: 'text-green-500', POST: 'text-blue-400', PUT: 'text-yellow-400',
    PATCH: 'text-orange-400', DELETE: 'text-red-400',
  }
  return map[method] ?? 'text-th-fg-muted'
}

function statusBadge(status: number) {
  if (status < 300) return 'bg-green-500/15 text-green-400'
  if (status < 400) return 'bg-yellow-500/15 text-yellow-400'
  return 'bg-red-500/15 text-red-400'
}
