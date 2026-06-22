'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronDown, Plus, Settings } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace.store'
import WorkspaceModal from './WorkspaceModal'

export default function WorkspaceSwitcher() {
  const t = useTranslations('workspace')
  const { workspaces, workspace: activeWorkspace, activeWorkspaceId, switchWorkspace } = useWorkspaceStore()
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const activeName = activeWorkspace?.name ?? workspaces.find(w => w.id === activeWorkspaceId)?.name ?? '…'
  const activeType = activeWorkspace?.type ?? workspaces.find(w => w.id === activeWorkspaceId)?.type ?? 'personal'

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-th-fg hover:bg-th-surface-hover transition-colors"
          title={t('switcher')}
        >
          {/* Type indicator dot */}
          {activeType === 'team' ? (
            <span className="rounded bg-blue-500/20 px-1 py-0.5 text-[10px] font-medium text-blue-400">Team</span>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-th-fg-muted/60" />
          )}
          <span className="max-w-[120px] truncate font-medium">{activeName}</span>
          <ChevronDown size={12} className={`text-th-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-th-border bg-th-surface shadow-lg py-1">
            {/* Workspace list */}
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => {
                  void switchWorkspace(ws.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-th-surface-hover transition-colors"
              >
                {ws.id === activeWorkspaceId ? (
                  <Check size={12} className="text-th-accent shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <span className="flex-1 truncate text-left text-th-fg">{ws.name}</span>
                {ws.type === 'team' && (
                  <span className="rounded bg-blue-500/20 px-1 py-0.5 text-[10px] font-medium text-blue-400">Team</span>
                )}
              </button>
            ))}

            {/* Divider */}
            <div className="my-1 border-t border-th-border" />

            {/* New workspace */}
            <button
              onClick={() => { setOpen(false); setShowCreate(true) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg transition-colors"
            >
              <Plus size={12} />
              {t('new')}
            </button>

            {/* Settings (edit active workspace) */}
            {activeWorkspaceId && (
              <button
                onClick={() => { setOpen(false); setShowEdit(true) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg transition-colors"
              >
                <Settings size={12} />
                {t('settings')}
              </button>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <WorkspaceModal
          mode="create"
          onClose={() => setShowCreate(false)}
        />
      )}

      {showEdit && activeWorkspaceId && (
        <WorkspaceModal
          mode="edit"
          workspaceId={activeWorkspaceId}
          initialName={activeName}
          initialType={activeType}
          initialDescription={activeWorkspace?.description ?? ''}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}
