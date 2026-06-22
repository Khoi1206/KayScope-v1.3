'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useCollectionStore, type CollectionItem } from '@/store/collection.store'
import { useRequestStore } from '@/store/request.store'
import { useExampleStore, type Example } from '@/store/example.store'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Trash2,
  MoreHorizontal,
  Plus,
  BookOpen,
  Eye,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/components/ui/cn'
import { downloadFile } from '@/lib/download'
import { CollectionRowSkeleton, RequestRowSkeleton } from '@/components/ui/Skeleton'
import CollectionVarsEditor from '../environment/CollectionVarsEditor'
import CollectionRunnerModal from '@/features/runner/CollectionRunnerModal'
import ExampleViewerModal from '@/features/response-viewer/ExampleViewerModal'
import InputModal from '@/components/InputModal'
import ConfirmModal from '@/components/ConfirmModal'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-blue-500',
  PUT: 'text-yellow-500',
  PATCH: 'text-orange-500',
  DELETE: 'text-red-500',
  HEAD: 'text-purple-500',
  OPTIONS: 'text-gray-400',
}

interface CollectionTreeProps {
  query?: string
}

export default function CollectionTree({ query = '' }: CollectionTreeProps) {
  const t = useTranslations()
  const {
    collections,
    folders,
    requests,
    expanded,
    loading,
    toggleExpanded,
    setExpanded,
    fetchFolders,
    fetchRequests,
    createFolder,
    createRequest,
    deleteCollection,
    deleteFolder,
    deleteRequest,
    reorderCollections,
    reorderFolders,
    reorderRequests,
  } = useCollectionStore()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const openTab = useRequestStore(s => s.openTab)
  const activeTabId = useRequestStore(s => s.activeTabId)
  const activeTabs = useRequestStore(s => s.tabs)
  const { examples, fetchExamples, deleteExample } = useExampleStore()

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

  // When search query is active, auto-load all collections so we can filter them
  useEffect(() => {
    if (!query.trim()) return
    for (const col of collections) {
      if (!requests[col.id]) {
        void Promise.all([fetchFolders(col.id), fetchRequests(col.id)])
      }
    }
  }, [query, collections]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter helpers
  const q = query.trim().toLowerCase()
  const matchesQ = (name: string) => !q || name.toLowerCase().includes(q)

  // A folder subtree has at least one matching request
  function folderHasMatch(folderId: string, colId: string): boolean {
    const colRequests = requests[colId] ?? []
    const colFolders = folders[colId] ?? []
    if (colRequests.some(r => r.folderId === folderId && matchesQ(r.name))) return true
    return colFolders.filter(f => f.parentFolderId === folderId).some(f => folderHasMatch(f.id, colId))
  }

  const [editingVars, setEditingVars] = useState<CollectionItem | null>(null)
  const [runningCollection, setRunningCollection] = useState<CollectionItem | null>(null)

  // Examples expand state (keyed by requestId)
  const [examplesExpanded, setExamplesExpanded] = useState<Record<string, boolean>>({})
  const [viewingExample, setViewingExample] = useState<{ example: Example; requestId: string } | null>(null)

  const [folderPrompt, setFolderPrompt] = useState<{ colId: string; parentFolderId?: string } | null>(null)
  const [requestPrompt, setRequestPrompt] = useState<{ colId: string; folderId?: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'collection'; id: string; name: string }
    | { kind: 'folder'; id: string; colId: string; name: string }
    | { kind: 'request'; id: string; colId: string; name: string }
    | null
  >(null)

  function toggleExamples(requestId: string) {
    const willExpand = !examplesExpanded[requestId]
    setExamplesExpanded(s => ({ ...s, [requestId]: willExpand }))
    if (willExpand && !examples[requestId]) {
      fetchExamples(requestId)
    }
  }

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

  function handleAddFolder(colId: string, parentFolderId?: string) {
    setFolderPrompt({ colId, parentFolderId })
  }

  async function confirmAddFolder(name: string) {
    if (!folderPrompt) return
    const { colId, parentFolderId } = folderPrompt
    await createFolder(colId, name, parentFolderId)
    setExpanded(colId, true)
    setFolderPrompt(null)
  }

  function handleAddRequest(colId: string, folderId?: string) {
    setRequestPrompt({ colId, folderId })
  }

  async function confirmAddRequest(name: string) {
    if (!requestPrompt) return
    const { colId, folderId } = requestPrompt
    const req = await createRequest(colId, name, folderId)
    setExpanded(colId, true)
    if (folderId) setExpanded(folderId, true)
    openTab(
      { id: req.id, title: req.name, requestId: req.id, collectionId: colId },
      { method: req.method, url: req.url }
    )
    setRequestPrompt(null)
  }

  function handleExportCollection(colId: string, colName: string, format: 'kayscope' | 'postman') {
    const ext = format === 'postman' ? 'postman_collection.json' : 'kayscope.json'
    downloadFile(
      `/api/collections/${colId}/export${format === 'postman' ? '?format=postman' : ''}`,
      `${colName}.${ext}`
    ).catch(err => console.error('Export failed', err))
  }

  function handleDeleteCollection(colId: string, name: string) {
    setDeleteTarget({ kind: 'collection', id: colId, name })
  }

  function handleDeleteFolder(id: string, colId: string, name: string) {
    setDeleteTarget({ kind: 'folder', id, colId, name })
  }

  function handleDeleteRequest(id: string, colId: string, name: string) {
    setDeleteTarget({ kind: 'request', id, colId, name })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'collection') await deleteCollection(deleteTarget.id)
    else if (deleteTarget.kind === 'folder') await deleteFolder(deleteTarget.id, deleteTarget.colId)
    else await deleteRequest(deleteTarget.id, deleteTarget.colId)
    setDeleteTarget(null)
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading && collections.length === 0) {
    return (
      <div className="flex flex-col gap-0.5 px-1 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <CollectionRowSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!loading && collections.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-th-fg-subtle">
        {t('sidebar.noCollections')}
      </p>
    )
  }

  function handleColDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = collections.findIndex(c => c.id === active.id)
    const newIdx = collections.findIndex(c => c.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    void reorderCollections(arrayMove(collections, oldIdx, newIdx).map(c => c.id))
  }

  return (
    <>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColDragEnd}>
    <SortableContext items={collections.map(c => c.id)} strategy={verticalListSortingStrategy}>
    <div className="flex flex-col gap-0.5">
      {collections.map(col => {
        const colFolders = folders[col.id] ?? []
        const colRequests = requests[col.id] ?? []

        // When searching: force-expand and filter
        const isSearching = !!q
        const isOpen = isSearching ? true : !!expanded[col.id]
        const visibleTopReqs = colRequests.filter(r => !r.folderId && matchesQ(r.name))
        const visibleFolders = colFolders.filter(f => !f.parentFolderId && (!isSearching || folderHasMatch(f.id, col.id)))
        const topLevelRequests = isSearching ? visibleTopReqs : colRequests.filter(r => !r.folderId)
        const visibleColFolders = isSearching ? visibleFolders : colFolders.filter(f => !f.parentFolderId)

        // Hide collection entirely when searching and nothing matches (collection name, requests, or folders)
        if (isSearching && !matchesQ(col.name) && requests[col.id] && visibleTopReqs.length === 0 && visibleFolders.length === 0) return null

        function handleReqDragEnd(event: DragEndEvent) {
          const { active, over } = event
          if (!over || active.id === over.id) return
          const oldIdx = topLevelRequests.findIndex(r => r.id === active.id)
          const newIdx = topLevelRequests.findIndex(r => r.id === over.id)
          if (oldIdx === -1 || newIdx === -1) return
          void reorderRequests(col.id, arrayMove(topLevelRequests, oldIdx, newIdx).map(r => r.id))
        }

        function handleFolderDragEnd(event: DragEndEvent) {
          const { active, over } = event
          if (!over || active.id === over.id) return
          const oldIdx = visibleColFolders.findIndex(f => f.id === active.id)
          const newIdx = visibleColFolders.findIndex(f => f.id === over.id)
          if (oldIdx === -1 || newIdx === -1) return
          void reorderFolders(col.id, arrayMove(visibleColFolders, oldIdx, newIdx).map(f => f.id))
        }

        return (
          <SortableItem key={col.id} id={col.id}>
            {/* Collection row */}
            <div className="group flex w-full items-center rounded px-2 py-0.5 text-sm font-medium hover:bg-th-surface-hover">
              <button
                onClick={() => handleExpandCollection(col.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left"
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
                    { label: 'Export', onClick: () => handleExportCollection(col.id, col.name, 'postman') },
                    { label: t('collection.delete'), onClick: () => handleDeleteCollection(col.id, col.name), danger: true },
                  ]}
                />
              </div>
            </div>

            {/* Expanded contents */}
            {isOpen && (
              <div className="ml-4 border-l border-th-border pl-2">
                {/* Skeleton while requests/folders are still loading for this collection */}
                {!requests[col.id] && (
                  <>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <RequestRowSkeleton key={i} />
                    ))}
                  </>
                )}

                {/* Top-level requests (sortable) */}
                {requests[col.id] && topLevelRequests.length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReqDragEnd}>
                    <SortableContext items={topLevelRequests.map(r => r.id)} strategy={verticalListSortingStrategy}>
                      {topLevelRequests.map(req => (
                        <SortableItem key={req.id} id={req.id}>
                          <RequestRow
                            req={req}
                            isActive={activeTabs.some(t => t.requestId === req.id && t.id === activeTabId)}
                            onOpen={() => handleOpenRequest(req.id, col.id)}
                            onDelete={() => handleDeleteRequest(req.id, col.id, req.name)}
                            examplesExpanded={!!examplesExpanded[req.id]}
                            onToggleExamples={() => toggleExamples(req.id)}
                            exampleList={examples[req.id]}
                            onViewExample={ex => setViewingExample({ example: ex, requestId: req.id })}
                            onDeleteExample={async exId => {
                              await deleteExample(exId, req.id)
                              const remaining = useExampleStore.getState().examples[req.id] ?? []
                              if (remaining.length === 0) setExamplesExpanded(s => ({ ...s, [req.id]: false }))
                            }}
                          />
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {/* Top-level folders (sortable) */}
                {visibleColFolders.length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFolderDragEnd}>
                    <SortableContext items={visibleColFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      {visibleColFolders.map(folder => (
                        <SortableItem key={folder.id} id={folder.id}>
                          <FolderRow
                            folder={folder}
                            allFolders={colFolders}
                            allRequests={colRequests}
                            searchQuery={q}
                            expanded={expanded}
                            onToggle={toggleExpanded}
                            onOpenRequest={rId => handleOpenRequest(rId, col.id)}
                            onAddRequest={fId => handleAddRequest(col.id, fId)}
                            onAddFolder={fId => handleAddFolder(col.id, fId)}
                            onDeleteFolder={(fId, fName) => handleDeleteFolder(fId, col.id, fName)}
                            onDeleteRequest={(rId, rName) => handleDeleteRequest(rId, col.id, rName)}
                            activeTabId={activeTabId}
                            activeTabs={activeTabs}
                            examplesExpanded={examplesExpanded}
                            onToggleExamples={toggleExamples}
                            examples={examples}
                            onViewExample={(ex, rId) => setViewingExample({ example: ex, requestId: rId })}
                            onDeleteExample={async (exId, rId) => {
                              await deleteExample(exId, rId)
                              const remaining = useExampleStore.getState().examples[rId] ?? []
                              if (remaining.length === 0) setExamplesExpanded(s => ({ ...s, [rId]: false }))
                            }}
                            reorderRequests={reorderRequests}
                            sensors={sensors}
                            collectionId={col.id}
                          />
                        </SortableItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                )}

                {requests[col.id] && colFolders.length === 0 && topLevelRequests.length === 0 && (
                  <p className="py-1 text-xs text-th-fg-subtle">{t('collection.empty')}</p>
                )}
              </div>
            )}
          </SortableItem>
        )
      })}
    </div>
    </SortableContext>
    </DndContext>

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
    {viewingExample && (
      <ExampleViewerModal
        example={viewingExample.example}
        requestId={viewingExample.requestId}
        onClose={() => setViewingExample(null)}
      />
    )}
    {folderPrompt && (
      <InputModal
        title={t('collection.folderNamePrompt')}
        confirmLabel={t('common.create')}
        onCancel={() => setFolderPrompt(null)}
        onConfirm={confirmAddFolder}
      />
    )}
    {requestPrompt && (
      <InputModal
        title={t('collection.requestNamePrompt')}
        confirmLabel={t('common.create')}
        onCancel={() => setRequestPrompt(null)}
        onConfirm={confirmAddRequest}
      />
    )}
    {deleteTarget && (
      <ConfirmModal
        message={
          deleteTarget.kind === 'collection'
            ? t('collection.deleteConfirm', { name: deleteTarget.name })
            : deleteTarget.kind === 'folder'
              ? t('collection.deleteFolderConfirm', { name: deleteTarget.name })
              : t('collection.deleteRequestConfirm', { name: deleteTarget.name })
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    )}
    </>
  )
}

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined }}
      className="group/sortable relative"
    >
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="absolute left-0 top-1/2 z-10 hidden -translate-x-3 -translate-y-1/2 cursor-grab p-0.5 text-th-fg-subtle active:cursor-grabbing group-hover/sortable:block"
      >
        <GripVertical size={10} />
      </button>
      {children}
    </div>
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

function ExampleRow({
  example,
  onView,
  onDelete,
}: {
  example: Example
  onView: () => void
  onDelete: () => void
}) {
  const t = useTranslations('examples')
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="group flex w-full items-center rounded hover:bg-th-surface-hover">
      <button
        onClick={onView}
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2 py-1 text-xs"
      >
        <BookOpen size={10} className="shrink-0 text-th-fg-subtle" />
        <span className="truncate text-th-fg-muted">{example.name}</span>
        {example.status != null && (
          <span className={cn(
            'shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums',
            example.status < 300 ? 'text-green-400' : example.status < 400 ? 'text-yellow-400' : 'text-red-400'
          )}>
            {example.status}
          </span>
        )}
      </button>
      <div className="hidden shrink-0 items-center pr-1 group-hover:flex">
        <button
          title={t('view')}
          onClick={e => { e.stopPropagation(); onView() }}
          className="rounded p-0.5 text-th-fg-muted hover:text-th-fg"
        >
          <Eye size={11} />
        </button>
        <button
          title="Delete example"
          onClick={e => { e.stopPropagation(); setConfirming(true) }}
          className="rounded p-0.5 text-th-fg-muted hover:text-red-400"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {confirming && (
        <ConfirmModal
          message={t('confirmDelete')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); onDelete() }}
        />
      )}
    </div>
  )
}

function RequestRow({
  req,
  isActive,
  onOpen,
  onDelete,
  examplesExpanded,
  onToggleExamples,
  exampleList,
  onViewExample,
  onDeleteExample,
}: {
  req: { id: string; name: string; method: string }
  isActive?: boolean
  onOpen: () => void
  onDelete: () => void
  examplesExpanded: boolean
  onToggleExamples: () => void
  exampleList?: Example[]
  onViewExample: (ex: Example) => void
  onDeleteExample: (exId: string) => void
}) {
  const t = useTranslations('examples')
  const hasExamples = exampleList && exampleList.length > 0

  return (
    <div>
      <div className={cn(
        'group flex w-full items-center rounded',
        isActive ? 'bg-th-surface-hover' : 'hover:bg-th-surface-hover'
      )}>
        <button
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2 py-1 text-xs"
        >
          <span
            onClick={hasExamples ? e => { e.stopPropagation(); onToggleExamples() } : undefined}
            title={hasExamples ? t('examples') : undefined}
            className={cn('w-3 shrink-0', hasExamples ? 'cursor-pointer text-th-fg-muted hover:text-th-fg' : '')}
          >
            {hasExamples && (examplesExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
          </span>
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

      {/* Examples sub-list */}
      {examplesExpanded && (
        <div className="ml-4 border-l border-th-border/50 pl-2">
          {exampleList === undefined ? (
            <p className="py-1 text-[10px] text-th-fg-subtle">Loading…</p>
          ) : exampleList.length === 0 ? (
            <p className="py-1 text-[10px] text-th-fg-subtle">{t('noExamples')}</p>
          ) : (
            exampleList.map(ex => (
              <ExampleRow
                key={ex.id}
                example={ex}
                onView={() => onViewExample(ex)}
                onDelete={() => onDeleteExample(ex.id)}
              />
            ))
          )}
        </div>
      )}
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
  examplesExpanded,
  onToggleExamples,
  examples,
  onViewExample,
  onDeleteExample,
  searchQuery = '',
  reorderRequests,
  sensors,
  collectionId,
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
  examplesExpanded: Record<string, boolean>
  onToggleExamples: (requestId: string) => void
  examples: Record<string, Example[]>
  onViewExample: (ex: Example, requestId: string) => void
  onDeleteExample: (exId: string, requestId: string) => void
  searchQuery?: string
  reorderRequests?: (collectionId: string, ids: string[]) => Promise<void>
  sensors?: ReturnType<typeof useSensors>
  collectionId?: string
}) {
  const t = useTranslations()
  const isSearching = !!searchQuery
  const isOpen = isSearching ? true : !!expanded[folder.id]
  const allChildFolders = allFolders.filter(f => f.parentFolderId === folder.id)
  const allChildRequests = allRequests.filter(r => r.folderId === folder.id)
  const childFolders = isSearching
    ? allChildFolders.filter(f => {
        const hasMatchingReq = (fId: string): boolean => {
          if (allRequests.some(r => r.folderId === fId && r.name.toLowerCase().includes(searchQuery))) return true
          return allFolders.filter(cf => cf.parentFolderId === fId).some(cf => hasMatchingReq(cf.id))
        }
        return hasMatchingReq(f.id)
      })
    : allChildFolders
  const childRequests = isSearching
    ? allChildRequests.filter(r => r.name.toLowerCase().includes(searchQuery))
    : allChildRequests

  function handleChildReqDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !reorderRequests || !collectionId) return
    const oldIdx = childRequests.findIndex(r => r.id === active.id)
    const newIdx = childRequests.findIndex(r => r.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    void reorderRequests(collectionId, arrayMove(childRequests, oldIdx, newIdx).map(r => r.id))
  }

  return (
    <div>
      <div className="group flex w-full items-center rounded hover:bg-th-surface-hover">
        <button
          onClick={() => onToggle(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-2 py-1 text-xs text-left"
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
          {sensors && reorderRequests && childRequests.length > 1 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChildReqDragEnd}>
              <SortableContext items={childRequests.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {childRequests.map(req => (
                  <SortableItem key={req.id} id={req.id}>
                    <RequestRow
                      req={req}
                      isActive={activeTabs.some(t => t.requestId === req.id && t.id === activeTabId)}
                      onOpen={() => onOpenRequest(req.id)}
                      onDelete={() => onDeleteRequest(req.id, req.name)}
                      examplesExpanded={!!examplesExpanded[req.id]}
                      onToggleExamples={() => onToggleExamples(req.id)}
                      exampleList={examples[req.id]}
                      onViewExample={ex => onViewExample(ex, req.id)}
                      onDeleteExample={exId => onDeleteExample(exId, req.id)}
                    />
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            childRequests.map(req => (
              <RequestRow
                key={req.id}
                req={req}
                isActive={activeTabs.some(t => t.requestId === req.id && t.id === activeTabId)}
                onOpen={() => onOpenRequest(req.id)}
                onDelete={() => onDeleteRequest(req.id, req.name)}
                examplesExpanded={!!examplesExpanded[req.id]}
                onToggleExamples={() => onToggleExamples(req.id)}
                exampleList={examples[req.id]}
                onViewExample={ex => onViewExample(ex, req.id)}
                onDeleteExample={exId => onDeleteExample(exId, req.id)}
              />
            ))
          )}
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
              examplesExpanded={examplesExpanded}
              onToggleExamples={onToggleExamples}
              examples={examples}
              onViewExample={onViewExample}
              onDeleteExample={onDeleteExample}
              searchQuery={searchQuery}
              reorderRequests={reorderRequests}
              sensors={sensors}
              collectionId={collectionId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
