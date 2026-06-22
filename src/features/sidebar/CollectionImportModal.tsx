'use client'

import { useRef, useState } from 'react'
import { X, Upload, CheckCircle, AlertCircle, Loader2, FolderOpen, FileText } from 'lucide-react'
import { parsePostmanCollection } from '@/lib/postman-import'
import { parseOpenApiDocument } from '@/lib/openapi-import'
import { useCollectionStore } from '@/store/collection.store'
import type { ParsedCollection, ParsedFolder, ParsedRequest } from '@/lib/postman-import'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  onClose: () => void
}

type ImportStatus = 'idle' | 'parsed' | 'importing' | 'done' | 'error'

export default function CollectionImportModal({ onClose }: Props) {
  useEscapeKey(onClose)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [parsed, setParsed] = useState<ParsedCollection | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [parseError, setParseError] = useState<string>('')
  const [importError, setImportError] = useState<string>('')
  const [progress, setProgress] = useState('')
  const { fetchCollections } = useCollectionStore()

  function detectAndParse(name: string, content: string) {
    const lower = name.toLowerCase()
    let result: { collection?: ParsedCollection; error?: string }

    if (lower.endsWith('.json')) {
      // Try Postman first, then OpenAPI
      result = parsePostmanCollection(content)
      if (result.error && result.error.includes('Postman')) {
        result = parseOpenApiDocument(content)
      }
      if (result.error) {
        // Both failed — give a helpful message
        result = { error: 'Not a recognized Postman Collection or OpenAPI document' }
      }
    } else {
      result = { error: 'Unsupported file type. Use .json (Postman Collection v2.1 or OpenAPI 3.x)' }
    }

    return result
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setImportError('')
    setStatus('idle')
    setParsed(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      const result = detectAndParse(file.name, content)
      if (result.error) {
        setParseError(result.error)
        setStatus('error')
      } else {
        setParsed(result.collection!)
        setStatus('parsed')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!parsed) return
    setStatus('importing')
    setImportError('')

    try {
      // 1. Create collection
      setProgress('Creating collection…')
      const colRes = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: parsed.name }),
      })
      if (!colRes.ok) {
        const d = await colRes.json()
        throw new Error(d.error ?? 'Failed to create collection')
      }
      const { id: collectionId } = await colRes.json()

      // 1b. Patch collection variables if any
      if (parsed.variables.length > 0) {
        setProgress('Saving collection variables…')
        await fetch(`/api/collections/${collectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variables: parsed.variables }),
        })
      }

      // 2. Create folders, mapping tempId → real id
      const folderIdMap = new Map<string, string>()
      for (const folder of parsed.folders) {
        await createFolderInOrder(folder, parsed.folders, folderIdMap, collectionId)
      }

      // 3. Create requests
      const total = parsed.requests.length
      for (let i = 0; i < total; i++) {
        const req = parsed.requests[i]
        setProgress(`Creating request ${i + 1} / ${total}…`)
        const folderId = req.folderTempId ? folderIdMap.get(req.folderTempId) : undefined
        await createRequest(req, collectionId, folderId)
      }

      await fetchCollections()
      setProgress('')
      setStatus('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">Import Collection</p>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Format note */}
          <p className="text-xs text-th-fg-muted">
            Supported formats: <span className="font-medium text-th-fg">Postman Collection v2.1</span> and <span className="font-medium text-th-fg">OpenAPI 3.x / Swagger 2.0</span> (JSON only)
          </p>

          {/* File picker */}
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-th-border px-4 py-6 text-sm text-th-fg-muted hover:border-th-accent hover:bg-th-surface hover:text-th-fg"
            >
              <Upload size={16} />
              {fileName ? fileName : 'Click to select a .json file'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview */}
          {parsed && status !== 'done' && (
            <div className="rounded-md border border-th-border bg-th-surface px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-th-fg">{parsed.name}</p>
              <div className="flex gap-4 text-xs text-th-fg-muted">
                <span className="flex items-center gap-1">
                  <FolderOpen size={12} />
                  {parsed.folders.length} folder{parsed.folders.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <FileText size={12} />
                  {parsed.requests.length} request{parsed.requests.length !== 1 ? 's' : ''}
                </span>
                {parsed.variables.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-[10px]">{'{}'}</span>
                    {parsed.variables.length} variable{parsed.variables.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {parsed.folders.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {parsed.folders.filter(f => !f.parentTempId).slice(0, 8).map(f => (
                    <span
                      key={f.tempId}
                      className="rounded bg-th-surface-hover px-1.5 py-0.5 text-[11px] text-th-fg-muted"
                    >
                      {f.name}
                    </span>
                  ))}
                  {parsed.folders.filter(f => !f.parentTempId).length > 8 && (
                    <span className="rounded bg-th-surface-hover px-1.5 py-0.5 text-[11px] text-th-fg-muted">
                      +{parsed.folders.filter(f => !f.parentTempId).length - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {status === 'importing' && (
            <div className="flex items-center gap-2 text-xs text-th-fg-muted">
              <Loader2 size={13} className="animate-spin" />
              {progress}
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {importError}
            </div>
          )}

          {/* Done */}
          {status === 'done' && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2.5 text-xs text-green-400">
              <CheckCircle size={14} className="shrink-0" />
              Collection "{parsed?.name}" imported successfully with {parsed?.folders.length} folder{parsed?.folders.length !== 1 ? 's' : ''} and {parsed?.requests.length} request{parsed?.requests.length !== 1 ? 's' : ''}.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            {status === 'done' ? 'Close' : 'Cancel'}
          </button>
          {status !== 'done' && (
            <button
              onClick={handleImport}
              disabled={!parsed || status === 'importing'}
              className="flex items-center gap-1.5 rounded bg-th-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-th-accent-hover disabled:opacity-50"
            >
              {status === 'importing' && <Loader2 size={12} className="animate-spin" />}
              Import
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createFolderInOrder(
  folder: ParsedFolder,
  allFolders: ParsedFolder[],
  idMap: Map<string, string>,
  collectionId: string,
) {
  if (idMap.has(folder.tempId)) return

  // Ensure parent exists first
  if (folder.parentTempId && !idMap.has(folder.parentTempId)) {
    const parent = allFolders.find(f => f.tempId === folder.parentTempId)
    if (parent) await createFolderInOrder(parent, allFolders, idMap, collectionId)
  }

  const body: Record<string, string> = {
    collectionId,
    name: folder.name,
  }
  if (folder.parentTempId && idMap.has(folder.parentTempId)) {
    body.parentFolderId = idMap.get(folder.parentTempId)!
  }

  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const d = await res.json()
    throw new Error(d.error ?? `Failed to create folder "${folder.name}"`)
  }
  const { id } = await res.json()
  idMap.set(folder.tempId, id)
}

async function createRequest(
  req: ParsedRequest,
  collectionId: string,
  folderId?: string,
) {
  const body: Record<string, unknown> = {
    collectionId,
    name: req.name,
    method: req.method,
    url: req.url,
  }
  if (folderId) body.folderId = folderId
  if (req.params?.length) body.params = req.params
  if (req.headers?.length) body.headers = req.headers
  if (req.body && req.body.type !== 'none') body.body = req.body
  if (req.auth && req.auth.type !== 'none') body.auth = req.auth
  if (req.preRequestScript) body.preRequestScript = req.preRequestScript
  if (req.postRequestScript) body.postRequestScript = req.postRequestScript

  const res = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const d = await res.json()
    throw new Error(d.error ?? `Failed to create request "${req.name}"`)
  }
}
