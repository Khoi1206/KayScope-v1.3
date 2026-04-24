'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useCollectionStore, type CollectionItem } from '@/store/collection.store'
import { useRequestStore } from '@/store/request.store'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Trash2,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'
import CollectionVarsEditor from '../environment/CollectionVarsEditor'
import CollectionRunnerModal from '@/features/runner/CollectionRunnerModal'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-blue-500',
  PUT: 'text-yellow-500',
  PATCH: 'text-orange-500',
  DELETE: 'text-red-500',
  HEAD: 'text-purple-500',
  OPTIONS: 'text-gray-400',
}

export default function CollectionTree() {
  const t = useTranslations()
  const {
    collections,
    folders,
    requests,
    expanded,
    toggleExpanded,
    setExpanded,
    fetchFolders,
    fetchRequests,
    createFolder,
    createRequest,
    deleteCollection,
    deleteFolder,
    deleteRequest,
  } = useCollectionStore()
  const openTab = useRequestStore(s => s.openTab)
  const activeTabId = useRequestStore(s => s.activeTabId)
  const activeTabs = useRequestStore(s => s.tabs)

  // Auto-expand tree to reveal the active tab's request
  useEffect(() => {
    if (!activeTabId) return
    const activeTab = activeTabs.find(t => t.id === activeTabId)
    if (!activeTab?.collectionId || !activeTab.requestId) return

    const colId = activeTab.collectionId
    setExpanded(colId, true)

    const loadAndExpand = async () => {
      const state = useCollectionStore.getState()
      if (!state.requests[colId]) {
        await Promise.all([fetchFolders(colId), fetchRequests(colId)])
      }
      const reqList = useCollectionStore.getState().requests[colId] ?? []
      const req = reqList.find(r => r.id === activeTab.requestId)
      if (req?.folderId) {
        const allFolders = useCollectionStore.getState().folders[colId] ?? []
        let fId: string | null | undefined = req.folderId
        while (fId) {
          setExpanded(fId, true)
          const folder = allFolders.find(f => f.id === fId)
          fId = folder?.parentFolderId
        }
      }
    }
    loadAndExpand()
  }, [activeTabId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [editingVars, setEditingVars] = useState<CollectionItem | null>(null)
  const [runningCollection, setRunningCollection] = useState<CollectionItem | null>(null)

  async function handleExpandCollection(colId: string) {
    toggleExpanded(colId)
    if (!expanded[colId]) {
      await Promise.all([fetchFolders(colId), fetchRequests(colId)])
    }
  }

  function handleOpenRequest(requestId: string, colId: string) {
    const reqList = requests[colId] ?? []
    const req = reqList.find(r => r.id === requestId)
    if (!req) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot: Record<string, any> = { method: req.method, url: req.url }
    if (req.params?.length) snapshot.params = req.params
    if (req.headers?.length) snapshot.headers = req.headers
    if (req.body && req.body.type !== 'none') snapshot.body = req.body
    if (req.auth && req.auth.type !== 'none') snapshot.auth = req.auth
    if (req.preRequestScript) snapshot.preRequestScript = req.preRequestScript
    if (req.postRequestScript) snapshot.postRequestScript = req.postRequestScript
    openTab({ id: requestId, title: req.name, requestId, collectionId: colId }, snapshot)
  }

  async function handleAddFolder(colId: string, parentFolderId?: string) {
    const name = prompt(t('collection.folderNamePrompt'))
    if (!name?.trim()) return
    await createFolder(colId, name.trim(), parentFolderId)
    setExpanded(colId, true)
  }

  async function handleAddRequest(colId: string, folderId?: string) {
    const name = prompt(t('collection.requestNamePrompt'))
    if (!name?.trim()) return
    const req = await createRequest(colId, name.trim(), folderId)
    setExpanded(colId, true)
    if (folderId) setExpanded(folderId, true)
    openTab(
      { id: req.id, title: req.name, requestId: req.id, collectionId: colId },
      { method: req.method, url: req.url }
    )
  }

  function handleExportCollection(colId: string, format: 'kayscope' | 'postman') {
    const a = document.createElement('a')
    a.href = `/api/collections/${colId}/export${format === 'postman' ? '?format=postman' : ''}`
    a.click()
  }

  async function handleDeleteCollection(colId: string, name: string) {
    if (!confirm(t('collection.deleteConfirm', { name }))) return
    await deleteCollection(colId)
  }

  async function handleDeleteFolder(id: string, colId: string, name: string) {
    if (!confirm(t('collection.deleteFolderConfirm', { name }))) return
    await deleteFolder(id, colId)
  }

  async function handleDeleteRequest(id: string, colId: string, name: string) {
    if (!confirm(t('collection.deleteRequestConfirm', { name }))) return
    await deleteRequest(id, colId)
  }

  if (collections.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-th-fg-subtle">
        {t('sidebar.noCollections')}
      </p>
    )
  }

  return (
    <>
    <div className="flex flex-col gap-0.5">
      {collections.map(col => {
        const isOpen = !!expanded[col.id]
        const colFolders = folders[col.id] ?? []
        const colRequests = requests[col.id] ?? []
        const topLevelRequests = colRequests.filter(r => !r.folderId)

        return (
          <div key={col.id}>
            {/* Collection row */}
            <div className="group flex w-full items-center rounded px-2 py-0.5 text-sm font-medium hover:bg-th-surface-hover">
              <button
                onClick={() => handleExpandCollection(col.id)}
                className="flex flex-1 items-center gap-1.5 overflow-hidden text-left"
              >
                {isOpen ? (
                  <ChevronDown size={14} className="shrink-0 text-th-fg-muted" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-th-fg-muted" />
                )}
                <span className="truncate text-th-fg">{col.name}</span>
              </button>
              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                <DropdownMenu
                  trigger={<Plus size={12} />}
                  items={[
                    { label: t('collection.addRequest'), onClick: () => handleAddRequest(col.id) },
                    { label: t('collection.addFolder'), onClick: () => handleAddFolder(col.id) },
                  ]}
                />
                <DropdownMenu
                  trigger={<MoreHorizontal size={12} />}
                  items={[
                    { label: t('collection.run'), onClick: () => setRunningCollection(col) },
                    { label: t('collection.variables'), onClick: () => setEditingVars(col) },
                    { label: t('collection.export'), onClick: () => handleExportCollection(col.id, 'kayscope') },
                    { label: t('collection.exportPostman'), onClick: () => handleExportCollection(col.id, 'postman') },
                    { label: t('collection.delete'), onClick: () => handleDeleteCollection(col.id, col.name), danger: true },
                  ]}
                />
              </div>
            </div>

            {/* Expanded contents */}
            {isOpen && (
              <div className="ml-4 border-l border-th-border pl-2">
                {topLevelRequests.map(req => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    isActive={activeTabs.some(t => t.requestId === req.id && t.id === activeTabId)}
                    onOpen={() => handleOpenRequest(req.id, col.id)}
                    onDelete={() => handleDeleteRequest(req.id, col.id, req.name)}
                  />
                ))}

                {colFolders.filter(f => !f.parentFolderId).map(folder => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    allFolders={colFolders}
                    allRequests={colRequests}
                    expanded={expanded}
                    onToggle={toggleExpanded}
                    onOpenRequest={rId => handleOpenRequest(rId, col.id)}
                    onAddRequest={fId => handleAddRequest(col.id, fId)}
                    onAddFolder={fId => handleAddFolder(col.id, fId)}
                    onDeleteFolder={(fId, fName) => handleDeleteFolder(fId, col.id, fName)}
                    onDeleteRequest={(rId, rName) => handleDeleteRequest(rId, col.id, rName)}
                    activeTabId={activeTabId}
                    activeTabs={activeTabs}
                  />
                ))}

                {colFolders.length === 0 && topLevelRequests.length === 0 && (
                  <p className="py-1 text-xs text-th-fg-subtle">{t('collection.empty')}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>

    {editingVars && (
      <CollectionVarsEditor
        collection={editingVars}
        onClose={() => setEditingVars(null)}
      />
    )}
    {runningCollection && (
      <CollectionRunnerModal
        collectionId={runningCollection.id}
        collectionName={runningCollection.name}
        onClose={() => setRunningCollection(null)}
      />
    )}
    </>
  )
}

function DropdownMenu({
  trigger,
  items,
}: {
  trigger: React.ReactNode
  items: { label: string; onClick: () => void; danger?: boolean }[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="rounded p-0.5 text-th-fg-muted hover:text-th-fg"
      >
        {trigger}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setOpen(false) }} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-th-border bg-th-bg py-1 shadow-xl">
            {items.map(item => (
              <button
                key={item.label}
                onClick={e => { e.stopPropagation(); setOpen(false); item.onClick() }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs hover:bg-th-surface-hover',
                  item.danger ? 'text-red-400' : 'text-th-fg'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RequestRow({
  req,
  isActive,
  onOpen,
  onDelete,
}: {
  req: { id: string; name: string; method: string }
  isActive?: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <div className={cn(
      'group flex w-full items-center rounded',
      isActive ? 'bg-th-surface-hover' : 'hover:bg-th-surface-hover'
    )}>
      <button
        onClick={onOpen}
        className="flex flex-1 items-center gap-2 overflow-hidden px-2 py-1 text-xs"
      >
        <span
          className={cn(
            'w-12 shrink-0 text-left font-mono font-semibold uppercase',
            METHOD_COLORS[req.method] ?? 'text-th-fg-muted'
          )}
        >
          {req.method}
        </span>
        <span className="truncate text-th-fg">{req.name}</span>
      </button>
      <div className="hidden shrink-0 items-center pr-1 group-hover:flex">
        <button
          title="Delete request"
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="rounded p-0.5 text-th-fg-muted hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function FolderRow({
  folder,
  allFolders,
  allRequests,
  expanded,
  onToggle,
  onOpenRequest,
  onAddRequest,
  onAddFolder,
  onDeleteFolder,
  onDeleteRequest,
  activeTabId,
  activeTabs,
}: {
  folder: { id: string; name: string; parentFolderId?: string | null }
  allFolders: Array<{ id: string; name: string; parentFolderId?: string | null }>
  allRequests: Array<{ id: string; name: string; method: string; folderId?: string | null }>
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onOpenRequest: (id: string) => void
  onAddRequest: (folderId: string) => void
  onAddFolder: (folderId: string) => void
  onDeleteFolder: (id: string, name: string) => void
  onDeleteRequest: (id: string, name: string) => void
  activeTabId: string | null
  activeTabs: Array<{ id: string; requestId?: string }>
}) {
  const t = useTranslations()
  const isOpen = !!expanded[folder.id]
  const childFolders = allFolders.filter(f => f.parentFolderId === folder.id)
  const childRequests = allRequests.filter(r => r.folderId === folder.id)

  return (
    <div>
      <div className="group flex w-full items-center rounded hover:bg-th-surface-hover">
        <button
          onClick={() => onToggle(folder.id)}
          className="flex flex-1 items-center gap-1.5 overflow-hidden px-2 py-1 text-xs text-left"
        >
          {isOpen ? (
            <ChevronDown size={12} className="shrink-0 text-th-fg-muted" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-th-fg-muted" />
          )}
          <Folder size={12} className="shrink-0 text-th-fg-muted" />
          <span className="truncate text-th-fg">{folder.name}</span>
        </button>
        <div className="hidden shrink-0 items-center pr-1 group-hover:flex">
          <DropdownMenu
            trigger={<MoreHorizontal size={12} />}
            items={[
              { label: t('collection.addRequest'), onClick: () => onAddRequest(folder.id) },
              { label: t('collection.addFolder'), onClick: () => onAddFolder(folder.id) },
              { label: t('collection.deleteFolder'), onClick: () => onDeleteFolder(folder.id, folder.name), danger: true },
            ]}
          />
        </div>
      </div>

      {isOpen && (
        <div className="ml-3 border-l border-th-border pl-2">
          {childRequests.map(req => (
            <RequestRow
              key={req.id}
              req={req}
              isActive={activeTabs.some(t => t.requestId === req.id && t.id === activeTabId)}
              onOpen={() => onOpenRequest(req.id)}
              onDelete={() => onDeleteRequest(req.id, req.name)}
            />
          ))}
          {childFolders.map(cf => (
            <FolderRow
              key={cf.id}
              folder={cf}
              allFolders={allFolders}
              allRequests={allRequests}
              expanded={expanded}
              onToggle={onToggle}
              onOpenRequest={onOpenRequest}
              onAddRequest={onAddRequest}
              onAddFolder={onAddFolder}
              onDeleteFolder={onDeleteFolder}
              onDeleteRequest={onDeleteRequest}
              activeTabId={activeTabId}
              activeTabs={activeTabs}
            />
          ))}
        </div>
      )}
    </div>
  )
}
