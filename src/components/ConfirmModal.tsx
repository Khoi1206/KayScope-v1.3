'use client'

import { useEscapeKey } from '@/hooks/useEscapeKey'
import { cn } from '@/components/ui/cn'

interface Props {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  useEscapeKey(onCancel)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-lg border border-th-border bg-th-bg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-th-border px-5 py-3">
            <p className="text-sm font-semibold text-th-fg">{title}</p>
          </div>
        )}
        <div className="px-5 py-4">
          <p className="text-sm text-th-fg-muted">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90',
              danger ? 'bg-red-500' : 'bg-th-accent'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
