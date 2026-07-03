'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useCollectionStore, type CollectionItem } from '@/store/collection.store'
import MonacoEditor from '@/components/MonacoEditor'

interface Props {
  collection: CollectionItem
  onClose: () => void
}

type ScriptTab = 'pre' | 'post'

export default function CollectionScriptsModal({ collection, onClose }: Props) {
  const { updateCollection } = useCollectionStore()
  const [tab, setTab] = useState<ScriptTab>('pre')
  const [preScript, setPreScript] = useState(collection.preRequestScript ?? '')
  const [postScript, setPostScript] = useState(collection.postRequestScript ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateCollection(collection.id, {
        preRequestScript: preScript,
        postRequestScript: postScript,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const HELP = `// Collection scripts run for every request in this collection.
// Pre-request: runs before each request's own pre-request script.
// Post-request: runs after each request's own post-request script.
//
// Available: pm.variables, pm.environment, pm.collectionVariables,
//            pm.globals, pm.request, pm.response (post only), pm.test(), pm.expect`

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex h-[560px] w-[700px] flex-col overflow-hidden rounded-xl border border-th-border bg-th-raised shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-th-fg">Collection Scripts</p>
            <p className="text-xs text-th-fg-muted">{collection.name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-th-fg-muted hover:text-th-fg">
            <X size={16} />
          </button>
        </div>

        {/* Script tab bar */}
        <div className="flex shrink-0 gap-0 border-b border-th-border bg-th-surface px-4">
          {(['pre', 'post'] as const).map(key => (
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
              {key === 'pre' ? 'Pre-request' : 'Post-request'}
              {((key === 'pre' && preScript.trim()) || (key === 'post' && postScript.trim())) && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-th-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Help text */}
        <div className="shrink-0 border-b border-th-border bg-th-surface/50 px-4 py-1.5">
          <p className="text-[11px] text-th-fg-subtle">
            {tab === 'pre'
              ? 'Runs before every request in this collection (before the request\'s own pre-request script)'
              : 'Runs after every request in this collection (after the request\'s own post-request script)'}
          </p>
        </div>

        {/* Editor */}
        <div className="relative flex-1 overflow-hidden">
          {tab === 'pre' ? (
            <MonacoEditor
              key="pre"
              value={preScript || HELP}
              language="javascript"
              height="100%"
              readOnly={false}
              onChange={v => setPreScript(v === HELP ? '' : (v ?? ''))}
            />
          ) : (
            <MonacoEditor
              key="post"
              value={postScript || HELP}
              language="javascript"
              height="100%"
              readOnly={false}
              onChange={v => setPostScript(v === HELP ? '' : (v ?? ''))}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-th-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border border-th-border px-3 py-1.5 text-xs text-th-fg-muted hover:text-th-fg"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-th-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
