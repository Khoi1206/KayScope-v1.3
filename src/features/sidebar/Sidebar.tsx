'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, MoreHorizontal, Upload, Download, Search, X, Copy } from 'lucide-react'
import { useUiStore } from '@/store/ui.store'
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
import TrashModal from './TrashModal'
import TestsSection from '../tests/TestSuiteList'
import FlowsSection from '../flows/FlowList'
import CookieJarSection from './CookieJarSection'
import { cn } from '@/components/ui/cn'
import { EnvRowSkeleton, GlobalVarRowSkeleton } from '@/components/ui/Skeleton'
import InputModal from '@/components/InputModal'
import ConfirmModal from '@/components/ConfirmModal'

interface SidebarProps {
  width?: number
}

export default function Sidebar({ width }: SidebarProps) {
  const { sidebarSection } = useUiStore()
  const { fetchWorkspace } = useWorkspaceStore()
  const [showCurlImport, setShowCurlImport] = useState(false)
  const [showCollectionImport, setShowCollectionImport] = useState(false)
  const [showEnvImport, setShowEnvImport] = useState(false)

  useEffect(() => {
    fetchWorkspace()
  }, [fetchWorkspace])

  return (
    <aside className="flex h-full shrink-0 flex-col bg-th-surface" style={{ width: width ?? 256 }}>
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
        {sidebarSection === 'tests' && <TestsSection />}
        {sidebarSection === 'flows' && <FlowsSection />}
        {sidebarSection === 'cookies' && <CookieJarSection />}
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
  const [showCreate, setShowCreate] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [query, setQuery] = useState('')

  async function handleCreate(name: string) {
    await createCollection(name)
    setShowCreate(false)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          {t('nav.collections')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowCreate(true)}
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
                  <button
                    onClick={() => { setMenuOpen(false); setShowTrash(true) }}
                    className="w-full px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
                  >
                    Trash
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mx-2 mb-1">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-th-fg-subtle pointer-events-none" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search requests…"
          className="w-full rounded-md border border-th-border bg-th-input py-1 pl-6 pr-6 text-xs text-th-fg placeholder:text-th-fg-subtle focus:border-th-accent focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-th-fg-subtle hover:text-th-fg"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-4">
        <CollectionTree query={query} />
      </div>
      {showCreate && (
        <InputModal
          title={t('common.newCollection')}
          confirmLabel={t('common.create')}
          onCancel={() => setShowCreate(false)}
          onConfirm={handleCreate}
        />
      )}
      {showTrash && <TrashModal onClose={() => setShowTrash(false)} />}
    </div>
  )
}

function EnvironmentsSection({ onImport }: { onImport: () => void }) {
  const t = useTranslations()
  const { environments, activeEnvironmentId, setActiveEnvironment, deleteEnvironment, duplicateEnvironment, loading: envLoading } =
    useEnvironmentStore()

  const [editing, setEditing] = useState<EnvironmentItem | null | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteEnvironment(deleteTarget.id)
    setDeleteTarget(null)
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
        {envLoading && environments.length === 0 && (
          <div className="flex flex-col gap-0.5 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <EnvRowSkeleton key={i} />
            ))}
          </div>
        )}
        {!envLoading && environments.length === 0 && (
          <p className="px-3 py-4 text-xs text-th-fg-subtle">
            No environments yet.{' '}
            <button onClick={() => setEditing(null)} className="text-th-accent hover:underline">
              Create one
            </button>{' '}
            to get started.
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
              className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden text-left"
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
                onClick={() => duplicateEnvironment(env.id)}
                title="Duplicate"
                className="rounded-md p-1 text-th-fg-muted transition-colors hover:bg-th-surface hover:text-th-fg"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => {
                  const data = JSON.stringify({ name: env.name, variables: env.variables }, null, 2)
                  const blob = new Blob([data], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${env.name.replace(/\s+/g, '-').toLowerCase()}-environment.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                title="Export environment"
                className="rounded-md p-1 text-th-fg-muted transition-colors hover:bg-th-surface hover:text-th-fg"
              >
                <Download size={12} />
              </button>
              <button
                onClick={() => setDeleteTarget({ id: env.id, name: env.name })}
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
      {deleteTarget && (
        <ConfirmModal
          message={`Delete environment "${deleteTarget.name}"?`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
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
        {/* Skeleton while workspace is being fetched */}
        {!workspace && (
          <div className="flex flex-col gap-1 pt-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <GlobalVarRowSkeleton key={i} />
            ))}
          </div>
        )}

        {workspace && (workspace.globalVariables ?? []).filter(v => v.enabled).length === 0 && (
          <p className="py-3 text-xs text-th-fg-subtle">
            No global variables yet.{' '}
            <button
              onClick={() => setOpen(true)}
              className="text-th-accent hover:underline"
            >
              Add one
            </button>
          </p>
        )}

        {workspace && (workspace.globalVariables ?? []).filter(v => v.enabled).length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            {workspace.globalVariables
              .filter(v => v.enabled)
              .map((v, i) => (
                <div key={i} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-th-surface-hover">
                  <span className="shrink-0 font-mono text-th-fg">{v.key}</span>
                  <span className="min-w-0 truncate font-mono text-th-fg-muted">
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
