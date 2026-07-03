'use client'

import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { generateSnippet, type SnippetLanguage, type SnippetInput } from '@/lib/snippet-generator'
import { cn } from '@/components/ui/cn'

interface Props {
  input: SnippetInput
  onClose: () => void
}

const LANGS: { key: SnippetLanguage; label: string }[] = [
  { key: 'curl', label: 'cURL' },
  { key: 'fetch', label: 'JS Fetch' },
  { key: 'axios', label: 'Axios' },
  { key: 'python', label: 'Python' },
]

export default function CodeSnippetModal({ input, onClose }: Props) {
  const [lang, setLang] = useState<SnippetLanguage>('curl')
  const [copied, setCopied] = useState(false)

  useEscapeKey(onClose)

  const snippet = generateSnippet(lang, input)

  function handleCopy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col rounded-xl border border-th-border bg-th-bg shadow-2xl"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-th-border px-4 py-3">
          <p className="text-sm font-semibold text-th-fg">Code Snippet</p>
          <button onClick={onClose} className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={14} />
          </button>
        </div>

        {/* Language tabs */}
        <div className="flex gap-0 border-b border-th-border bg-th-surface px-4">
          {LANGS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setLang(key)}
              className={cn(
                'relative px-3 py-2 text-xs font-medium transition-colors',
                lang === key
                  ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                  : 'text-th-fg-muted hover:text-th-fg'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Code area */}
        <div className="relative flex-1 overflow-auto">
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-th-border bg-th-surface px-2 py-1 text-xs text-th-fg-muted transition-colors hover:text-th-fg"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <pre className="p-4 text-xs leading-relaxed text-th-fg">
            <code>{snippet}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
