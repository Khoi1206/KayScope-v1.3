'use client'

// This module is ONLY ever executed on the client (loaded via dynamic ssr:false).
// Safe to import monaco-editor synchronously here — no Node.js SSR crash.
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import type { EditorProps } from '@monaco-editor/react'

// Tell the loader to use the locally-bundled monaco-editor package instead of
// fetching from jsDelivr CDN. Must run synchronously before any <Editor> renders.
loader.config({ monaco })

type EditorOptions = NonNullable<EditorProps['options']>

interface Props {
  value: string
  onChange?: (value: string) => void
  language?: string
  height?: string
  readOnly?: boolean
}

export default function MonacoEditorInner({
  value,
  onChange,
  language = 'javascript',
  height = '200px',
  readOnly = false,
}: Props) {
  const options: EditorOptions = {
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    readOnly,
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 8, bottom: 8 },
  }

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme="vs-dark"
      options={options}
      loading="Loading editor..."
      onChange={v => onChange?.(v ?? '')}
    />
  )
}
