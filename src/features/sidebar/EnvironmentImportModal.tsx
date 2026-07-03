'use client'

import { useRef, useState } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useEnvironmentStore } from '@/store/environment.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  onClose: () => void
}

interface ParsedEnv {
  name: string
  variables: { key: string; value: string; enabled: boolean; secret: boolean }[]
}

function parsePostmanEnvironment(content: string): { env?: ParsedEnv; error?: string } {
  let raw: unknown
  try { raw = JSON.parse(content) } catch { return { error: 'Invalid JSON' } }
  if (typeof raw !== 'object' || raw === null) return { error: 'Not a JSON object' }

  const doc = raw as Record<string, unknown>

  // Postman environment format: { name, values: [{key, value, enabled}] }
  if (typeof doc.name === 'string' && Array.isArray(doc.values)) {
    const variables = (doc.values as Array<Record<string, unknown>>)
      .filter(v => v.key && v.type !== 'secret')
      .map(v => ({
        key: String(v.key ?? ''),
        value: String(v.value ?? ''),
        enabled: v.enabled !== false,
        secret: v.type === 'secret',
      }))
    return { env: { name: doc.name, variables } }
  }

  // KayScope environment export: { name, variables: [{key, value, enabled, secret}] }
  if (typeof doc.name === 'string' && Array.isArray(doc.variables)) {
    const variables = (doc.variables as Array<Record<string, unknown>>).map(v => ({
      key: String(v.key ?? ''),
      value: String(v.value ?? ''),
      enabled: v.enabled !== false,
      secret: Boolean(v.secret),
    }))
    return { env: { name: doc.name, variables } }
  }

  return { error: 'Not a recognized environment format (Postman or KayScope)' }
}

export default function EnvironmentImportModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { createEnvironment } = useEnvironmentStore()

  const [parsed, setParsed] = useState<ParsedEnv | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [done, setDone] = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setImportError('')
    setParsed(null)
    setDone(false)

    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      const result = parsePostmanEnvironment(content)
      if (result.error) {
        setParseError(result.error)
      } else {
        setParsed(result.env!)
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    setImportError('')
    try {
      await createEnvironment(parsed.name, parsed.variables)
      setDone(true)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">Import Environment</p>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-xs text-th-fg-muted">
            Supported: <span className="font-medium text-th-fg">Postman Environment</span> and <span className="font-medium text-th-fg">KayScope Environment</span> (.json)
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-th-border px-4 py-5 text-sm text-th-fg-muted hover:border-th-accent hover:bg-th-surface hover:text-th-fg"
          >
            <Upload size={15} />
            {fileName || 'Click to select a .json file'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}

          {parsed && !done && (
            <div className="rounded-md border border-th-border bg-th-surface px-4 py-3">
              <p className="mb-1 text-sm font-semibold text-th-fg">{parsed.name}</p>
              <p className="text-xs text-th-fg-muted">{parsed.variables.length} variable{parsed.variables.length !== 1 ? 's' : ''}</p>
              {parsed.variables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {parsed.variables.slice(0, 8).map(v => (
                    <span key={v.key} className="rounded bg-th-surface-hover px-1.5 py-0.5 font-mono text-[11px] text-th-fg-muted">{v.key}</span>
                  ))}
                  {parsed.variables.length > 8 && (
                    <span className="rounded bg-th-surface-hover px-1.5 py-0.5 text-[11px] text-th-fg-muted">+{parsed.variables.length - 8} more</span>
                  )}
                </div>
              )}
            </div>
          )}

          {importError && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {importError}
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2.5 text-xs text-green-400">
              <CheckCircle size={14} className="shrink-0" />
              Environment &ldquo;{parsed?.name}&rdquo; imported with {parsed?.variables.length} variable{parsed?.variables.length !== 1 ? 's' : ''}.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={handleImport}
              disabled={!parsed || importing}
              className="flex items-center gap-1.5 rounded bg-th-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-th-accent-hover disabled:opacity-50"
            >
              {importing && <Loader2 size={12} className="animate-spin" />}
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
