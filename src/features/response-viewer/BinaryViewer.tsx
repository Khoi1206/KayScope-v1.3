'use client'

import { useState } from 'react'
import { Download, Eye, EyeOff } from 'lucide-react'

interface Props {
  body: string        // base64-encoded
  contentType: string
  size: number
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function guessExtension(contentType: string): string {
  const lower = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  const map: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
    'image/ico': 'ico', 'image/x-icon': 'ico',
    'application/pdf': 'pdf', 'application/zip': 'zip',
    'application/gzip': 'gz', 'application/octet-stream': 'bin',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
  }
  return map[lower] ?? 'bin'
}

export default function BinaryViewer({ body, contentType, size }: Props) {
  const [showRaw, setShowRaw] = useState(false)
  const lower = (contentType.split(';')[0]?.trim() ?? '').toLowerCase()
  const isImage = lower.startsWith('image/')
  const isPdf = lower === 'application/pdf'
  const ext = guessExtension(contentType)

  function download() {
    const bytes = atob(body)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: contentType || 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `response.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const dataUri = `data:${contentType || 'application/octet-stream'};base64,${body}`

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-th-border bg-th-surface px-3 py-1.5">
        <span className="rounded bg-th-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-th-fg-muted">
          {contentType || 'binary'}
        </span>
        <span className="text-[10px] text-th-fg-subtle">{formatSize(size)}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            {showRaw ? <EyeOff size={12} /> : <Eye size={12} />}
            {showRaw ? 'Hide base64' : 'Show base64'}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
          >
            <Download size={12} />
            Download .{ext}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!showRaw && isImage && (
          <div className="flex h-full items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUri}
              alt="Response image"
              className="max-h-full max-w-full rounded object-contain shadow-md"
            />
          </div>
        )}
        {!showRaw && isPdf && (
          <iframe
            src={dataUri}
            title="PDF response"
            className="h-full w-full"
          />
        )}
        {!showRaw && !isImage && !isPdf && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-th-surface-hover text-th-fg-muted">
              <Download size={28} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-th-fg">Binary response</p>
              <p className="mt-1 text-xs text-th-fg-subtle">
                {contentType || 'Unknown content type'} · {formatSize(size)}
              </p>
            </div>
            <button
              onClick={download}
              className="flex items-center gap-1.5 rounded-md bg-th-accent px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Download size={13} />
              Download .{ext}
            </button>
          </div>
        )}
        {showRaw && (
          <pre className="p-4 font-mono text-[11px] text-th-fg break-all whitespace-pre-wrap">
            {body}
          </pre>
        )}
      </div>
    </div>
  )
}
