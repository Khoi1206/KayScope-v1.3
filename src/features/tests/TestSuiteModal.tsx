'use client'

import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { useTestSuiteStore, type TestSuiteItem } from '@/store/test-suite.store'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore } from '@/store/environment.store'
import { parseDataFile, detectFileType } from '@/lib/data-parser'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  suite: TestSuiteItem | null  // null = create new
  // Pre-select a collection when creating from a collection context menu
  defaultCollectionId?: string
  onClose: () => void
}

export default function TestSuiteModal({ suite, defaultCollectionId, onClose }: Props) {
  useEscapeKey(onClose)
  const isEdit = !!suite
  const { createSuite, updateSuite } = useTestSuiteStore()
  const { collections } = useCollectionStore()
  const { environments } = useEnvironmentStore()

  const [name, setName] = useState(suite?.name ?? '')
  const [description, setDescription] = useState(suite?.description ?? '')
  const [collectionId, setCollectionId] = useState(suite?.collectionId ?? defaultCollectionId ?? '')
  const [environmentId, setEnvironmentId] = useState(suite?.environmentId ?? '')
  const [dataRows, setDataRows] = useState<Record<string, string>[]>(suite?.dataRows ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!name.trim()) { setError('Suite name is required'); return }
    if (!collectionId) { setError('Please select a collection'); return }
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateSuite(suite.id, {
          name: name.trim(),
          description: description.trim() || null,
          environmentId: environmentId || null,
          dataRows,
        })
      } else {
        await createSuite({
          collectionId,
          name: name.trim(),
          description: description.trim() || undefined,
          environmentId: environmentId || undefined,
          dataRows,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

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
      setFileError(null)
    }
    reader.readAsText(file)
  }

  function clearDataRows() {
    setDataRows([])
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">
            {isEdit ? 'Edit Test Suite' : 'New Test Suite'}
          </p>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-th-fg-muted">Suite Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Auth Flow Tests"
              className="rounded border border-th-border bg-th-input px-3 py-1.5 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-th-fg-muted">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              className="rounded border border-th-border bg-th-input px-3 py-1.5 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
            />
          </div>

          {/* Collection selector (read-only in edit mode) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-th-fg-muted">Collection *</label>
            {isEdit ? (
              <p className="rounded border border-th-border bg-th-surface px-3 py-1.5 text-sm text-th-fg-muted">
                {collections.find(c => c.id === suite.collectionId)?.name ?? suite.collectionId}
              </p>
            ) : (
              <select
                value={collectionId}
                onChange={e => setCollectionId(e.target.value)}
                className="rounded border border-th-border bg-th-input px-2 py-1.5 text-sm text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
              >
                <option value="">Select a collection</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Environment selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-th-fg-muted">Environment</label>
            <select
              value={environmentId}
              onChange={e => setEnvironmentId(e.target.value)}
              className="rounded border border-th-border bg-th-input px-2 py-1.5 text-sm text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
            >
              <option value="">No Environment</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>

          {/* Data rows */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-th-fg-muted">Data Rows (for iteration)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded border border-th-border px-2.5 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
              >
                <Upload size={12} />
                Import from CSV / JSON
              </button>
              {dataRows.length > 0 && (
                <button
                  type="button"
                  onClick={clearDataRows}
                  className="text-xs text-th-fg-subtle hover:text-th-fg"
                >
                  Clear
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileChange} />
            {fileError && <p className="text-xs text-red-400">{fileError}</p>}
            {dataRows.length > 0 ? (
              <p className="text-xs text-th-fg-muted">
                {dataRows.length} data row{dataRows.length !== 1 ? 's' : ''} saved
                {dataRows[0] && Object.keys(dataRows[0]).length > 0 && (
                  <span className="ml-1 text-th-fg-subtle">
                    — columns: {Object.keys(dataRows[0]).join(', ')}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-th-fg-subtle">
                No data rows — suite runs once with no iteration data
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-th-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-th-accent-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Suite'}
          </button>
        </div>
      </div>
    </div>
  )
}
