'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen, Layers, History, Plus, Pencil, Trash2, Globe, MoreHorizontal, Upload } from 'lucide-react'
import { useUiStore, type SidebarSection } from '@/store/ui.store'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore, type EnvironmentItem } from '@/store/environment.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import CollectionTree from './CollectionTree'
import HistoryList from './HistoryList'
import EnvironmentEditor from '../environment/EnvironmentEditor'
import GlobalVarsEditor from '../variables/GlobalVarsEditor'
import CurlImportModal from './CurlImportModal'
import CollectionImportModal from './CollectionImportModal'
import EnvironmentImportModal from './EnvironmentImportModal'
import { cn } from '@/components/ui/cn'

export default function Sidebar() {
  const t = useTranslations()
  const { sidebarSection, setSidebarSection } = useUiStore()
  const { fetchWorkspace } = useWorkspaceStore()
  const [showCurlImport, setShowCurlImport] = useState(false)
  const [showCollectionImport, setShowCollectionImport] = useState(false)
  const [showEnvImport, setShowEnvImport] = useState(false)

  useEffect(() => {
    fetchWorkspace()
  }, [fetchWorkspace])

  const navItems: { section: SidebarSection; icon: React.ReactNode; label: string }[] = [
    { section: 'collections', icon: <FolderOpen size={18} />, label: t('nav.collections') },
    { section: 'environments', icon: <Layers size={18} />, label: t('nav.environments') },
    { section: 'globals', icon: <Globe size={18} />, label: t('nav.globals') },
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
              'relative flex flex-1 items-center justify-center py-2 text-th-fg-muted transition-colors hover:text-th-fg',
              sidebarSection === section
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-th-accent after:z-10'
                : 'hover:bg-th-surface-hover/50'
            )}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {sidebarSection === 'collections' && (
          <CollectionsSection
            onImportCurl={() => setShowCurlImport(true)}
            onImportCollection={() => setShowCollectionImport(true)}
          />
        )}
        {sidebarSection === 'environments' && <EnvironmentsSection onImport={() => setShowEnvImport(true)} />}
        {sidebarSection === 'globals' && <GlobalsSection />}
        {sidebarSection === 'history' && <HistorySection />}
      </div>

      {showCurlImport && <CurlImportModal onClose={() => setShowCurlImport(false)} />}
      {showCollectionImport && <CollectionImportModal onClose={() => setShowCollectionImport(false)} />}
      {showEnvImport && <EnvironmentImportModal onClose={() => setShowEnvImport(false)} />}
    </aside>
  )
}

function CollectionsSection({ onImportCurl, onImportCollection }: { onImportCurl: () => void; onImportCollection: () => void }) {
  const t = useTranslations()
  const { createCollection } = useCollectionStore()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleCreate() {
    const name = prompt(t('common.name'))
    if (name?.trim()) {
      await createCollection(name.trim())
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          {t('nav.collections')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCreate}
            title={t('common.newCollection')}
            className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <Plus size={13} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              title="More"
              className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-th-border bg-th-bg py-1 shadow-xl">
                  <button
                    onClick={() => { setMenuOpen(false); onImportCollection() }}
                    className="w-full px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
                  >
                    {t('import.collection')}
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onImportCurl() }}
                    className="w-full px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
                  >
                    {t('import.curl')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        <CollectionTree />
      </div>
    </div>
  )
}

function EnvironmentsSection({ onImport }: { onImport: () => void }) {
  const t = useTranslations()
  const { environments, activeEnvironmentId, setActiveEnvironment, deleteEnvironment } =
    useEnvironmentStore()

  const [editing, setEditing] = useState<EnvironmentItem | null | undefined>(undefined)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete environment "${name}"?`)) return
    await deleteEnvironment(id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          {t('nav.environments')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onImport}
            title="Import environment"
            className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <Upload size={13} />
          </button>
          <button
            onClick={() => setEditing(null)}
            title={t('common.new')}
            className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {environments.length === 0 && (
          <p className="px-3 py-4 text-xs text-th-fg-subtle">
            No environments yet. Create one to get started.
          </p>
        )}
        {environments.map(env => (
          <div
            key={env.id}
            className={cn(
              'group flex w-full items-center rounded-md mx-1 px-2 py-2 transition-colors hover:bg-th-surface-hover',
              activeEnvironmentId === env.id && 'bg-th-surface-hover'
            )}
          >
            <button
              onClick={() =>
                setActiveEnvironment(activeEnvironmentId === env.id ? null : env.id)
              }
              className="flex flex-1 items-center gap-2.5 overflow-hidden text-left"
            >
              <div
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full transition-colors',
                  activeEnvironmentId === env.id ? 'bg-th-accent shadow-[0_0_6px] shadow-th-accent/50' : 'bg-th-border'
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
                className="rounded-md p-1 text-th-fg-muted transition-colors hover:bg-th-surface hover:text-th-fg"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleDelete(env.id, env.name)}
                title="Delete"
                className="rounded-md p-1 text-th-fg-muted transition-colors hover:bg-th-surface hover:text-red-400"
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

function GlobalsSection() {
  const t = useTranslations()
  const { workspace } = useWorkspaceStore()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          {t('nav.globals')}
        </span>
        <button
          onClick={() => setOpen(true)}
          title="Edit global variables"
          className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Pencil size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {(workspace?.globalVariables ?? []).length === 0 ? (
          <p className="py-3 text-xs text-th-fg-subtle">
            No global variables yet.{' '}
            <button
              onClick={() => setOpen(true)}
              className="text-th-accent hover:underline"
            >
              Add one
            </button>
          </p>
        ) : (
          <div className="flex flex-col gap-1 pt-1">
            {workspace!.globalVariables
              .filter(v => v.enabled)
              .map((v, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-th-surface-hover">
                  <span className="shrink-0 font-mono text-th-fg">{v.key}</span>
                  <span className="truncate font-mono text-th-fg-muted">
                    {v.secret ? '••••••••' : v.value}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {open && <GlobalVarsEditor onClose={() => setOpen(false)} />}
    </div>
  )
}

function HistorySection() {
  const t = useTranslations()
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          {t('nav.history')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        <HistoryList />
      </div>
    </div>
  )
}
