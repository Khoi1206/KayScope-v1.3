'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, Layers, History, Plus, Pencil, Trash2 } from 'lucide-react'
import { useUiStore, type SidebarSection } from '@/store/ui.store'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore, type EnvironmentItem } from '@/store/environment.store'
import CollectionTree from './CollectionTree'
import HistoryList from './HistoryList'
import EnvironmentEditor from '../environment/EnvironmentEditor'
import { cn } from '@/components/ui/cn'

export default function Sidebar() {
  const t = useTranslations()
  const { sidebarSection, setSidebarSection } = useUiStore()

  const navItems: { section: SidebarSection; icon: React.ReactNode; label: string }[] = [
    { section: 'collections', icon: <FolderOpen size={18} />, label: t('nav.collections') },
    { section: 'environments', icon: <Layers size={18} />, label: t('nav.environments') },
    { section: 'history', icon: <History size={18} />, label: t('nav.history') },
  ]

  return (
    <aside className="flex h-full w-64 flex-col border-r border-th-border bg-th-surface">
      {/* Section tabs */}
      <div className="flex border-b border-th-border">
        {navItems.map(({ section, icon, label }) => (
          <button
            key={section}
            onClick={() => setSidebarSection(section)}
            title={label}
            className={cn(
              'flex flex-1 items-center justify-center py-3 text-th-fg-muted transition-colors hover:text-th-fg',
              sidebarSection === section && 'border-b-2 border-th-accent text-th-fg'
            )}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {sidebarSection === 'collections' && <CollectionsSection />}
        {sidebarSection === 'environments' && <EnvironmentsSection />}
        {sidebarSection === 'history' && <HistorySection />}
      </div>
    </aside>
  )
}

function CollectionsSection() {
  const t = useTranslations()
  const { createCollection } = useCollectionStore()

  async function handleCreate() {
    const name = prompt(t('common.name'))
    if (name?.trim()) {
      await createCollection(name.trim())
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-th-fg-muted">
          {t('nav.collections')}
        </span>
        <button
          onClick={handleCreate}
          title={t('common.new')}
          className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        <CollectionTree />
      </div>
    </div>
  )
}

function EnvironmentsSection() {
  const t = useTranslations()
  const { environments, activeEnvironmentId, setActiveEnvironment, deleteEnvironment } =
    useEnvironmentStore()

  // undefined = closed, null = create, EnvironmentItem = edit
  const [editing, setEditing] = useState<EnvironmentItem | null | undefined>(undefined)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete environment "${name}"?`)) return
    await deleteEnvironment(id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-th-fg-muted">
          {t('nav.environments')}
        </span>
        <button
          onClick={() => setEditing(null)}
          title={t('common.new')}
          className="rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {environments.length === 0 && (
          <p className="px-2 py-3 text-xs text-th-fg-subtle">
            No environments yet. Create one to get started.
          </p>
        )}
        {environments.map(env => (
          <div
            key={env.id}
            className="group flex w-full items-center rounded px-2 py-1.5 hover:bg-th-surface-hover"
          >
            <button
              onClick={() =>
                setActiveEnvironment(activeEnvironmentId === env.id ? null : env.id)
              }
              className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            >
              <div
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  activeEnvironmentId === env.id ? 'bg-th-accent' : 'bg-th-border'
                )}
              />
              <span
                className={cn(
                  'truncate text-xs',
                  activeEnvironmentId === env.id
                    ? 'font-medium text-th-fg'
                    : 'text-th-fg-muted'
                )}
              >
                {env.name}
              </span>
            </button>
            <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
              <button
                onClick={() => setEditing(env)}
                title="Edit"
                className="rounded p-0.5 text-th-fg-muted hover:text-th-fg"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleDelete(env.id, env.name)}
                title="Delete"
                className="rounded p-0.5 text-th-fg-muted hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing !== undefined && (
        <EnvironmentEditor env={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}

function HistorySection() {
  const t = useTranslations()
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-th-fg-muted">
          {t('nav.history')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        <HistoryList />
      </div>
    </div>
  )
}
