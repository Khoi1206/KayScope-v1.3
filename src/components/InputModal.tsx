'use client'

import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  title: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function InputModal({
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Create',
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  useEscapeKey(onCancel)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim()) onConfirm(value.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-th-border px-5 py-3">
          <p className="text-sm font-semibold text-th-fg">{title}</p>
        </div>
        <div className="px-5 py-4">
          {label && <label className="mb-1.5 block text-xs font-medium text-th-fg-muted">{label}</label>}
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-md border border-th-border bg-th-input px-3 py-1.5 text-sm text-th-fg outline-none focus:border-th-accent focus:ring-1 focus:ring-th-accent/50"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
