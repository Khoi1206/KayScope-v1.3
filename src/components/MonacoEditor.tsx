'use client'

// Outer shell: ssr:false ensures MonacoEditorInner (which imports monaco-editor
// synchronously) never runs on the Node.js server where browser APIs don't exist.
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(() => import('./MonacoEditorInner'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center overflow-hidden rounded border border-th-border text-sm text-th-fg-muted"
      style={{ height: '200px' }}
    >
      Loading editor...
    </div>
  ),
})

export default MonacoEditor
