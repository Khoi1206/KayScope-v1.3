'use client'

import { useState } from 'react'
import { useCollectionStore, type CollectionItem } from '@/store/collection.store'
import { useRequestStore } from '@/store/request.store'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderPlus,
  FilePlus,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/components/ui/cn'
import CollectionVarsEditor from '../environment/CollectionVarsEditor'

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
  const [editingVars, setEditingVars] = useState<CollectionItem | null>(null)

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
    openTab(
      { id: requestId, title: req.name, requestId, collectionId: colId },
      { method: req.method, url: req.url }
    )
  }

  async function handleAddFolder(colId: string, parentFolderId?: string) {
    const name = prompt('Folder name')
    if (!name?.trim()) return
    await createFolder(colId, name.trim(), parentFolderId)
    setExpanded(colId, true)
  }

  async function handleAddRequest(colId: string, folderId?: string) {
    const name = prompt('Request name')
    if (!name?.trim()) return
    const req = await createRequest(colId, name.trim(), folderId)
    setExpanded(colId, true)
    if (folderId) setExpanded(folderId, true)
    openTab(
      { id: req.id, title: req.name, requestId: req.id, collectionId: colId },
      { method: req.method, url: req.url }
    )
  }

  async function handleDeleteCollection(colId: string, name: string) {
    if (!confirm(`Delete collection "${name}"? This will also delete all folders and requests inside it.`)) return
    await deleteCollection(colId)
  }

  async function handleDeleteFolder(id: string, colId: string, name: string) {
    if (!confirm(`Delete folder "${name}"?`)) return
    await deleteFolder(id, colId)
  }

  async function handleDeleteRequest(id: string, colId: string, name: string) {
    if (!confirm(`Delete request "${name}"?`)) return
    await deleteRequest(id, colId)
  }

  if (collections.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-th-fg-subtle">
        No collections yet. Create one to get started.
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
            <div className="group flex w-full items-center rounded px-2 py-1 text-sm font-medium hover:bg-th-surface-hover">
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
                <ActionBtn title="Collection variables" onClick={() => setEditingVars(col)}>
                  <SlidersHorizontal size={12} />
                </ActionBtn>
                <ActionBtn title="Add folder" onClick={() => handleAddFolder(col.id)}>
                  <FolderPlus size={12} />
                </ActionBtn>
                <ActionBtn title="Add request" onClick={() => handleAddRequest(col.id)}>
                  <FilePlus size={12} />
                </ActionBtn>
                <ActionBtn
                  title="Delete collection"
                  onClick={() => handleDeleteCollection(col.id, col.name)}
                  danger
                >
                  <Trash2 size={12} />
                </ActionBtn>
              </div>
            </div>

            {/* Expanded contents */}
            {isOpen && (
              <div className="ml-4 border-l border-th-border pl-2">
                {topLevelRequests.map(req => (
                  <RequestRow
                    key={req.id}
                    req={req}
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
                    onDeleteFolder={(fId, fName) => handleDeleteFolder(fId, col.id, fName)}
                    onDeleteRequest={(rId, rName) => handleDeleteRequest(rId, col.id, rName)}
                  />
                ))}

                {colFolders.length === 0 && topLevelRequests.length === 0 && (
                  <p className="py-1 text-xs text-th-fg-subtle">Empty collection</p>
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
    </>
  )
}

function ActionBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string
  onClick: (e: React.MouseEvent) => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={e => {
        e.stopPropagation()
        onClick(e)
      }}
      className={cn(
        'rounded p-0.5',
        danger
          ? 'text-th-fg-muted hover:text-red-400'
          : 'text-th-fg-muted hover:text-th-fg'
      )}
    >
      {children}
    </button>
  )
}

function RequestRow({
  req,
  onOpen,
  onDelete,
}: {
  req: { id: string; name: string; method: string }
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex w-full items-center rounded hover:bg-th-surface-hover">
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
        <ActionBtn title="Delete request" onClick={e => { e.stopPropagation(); onDelete() }} danger>
          <Trash2 size={12} />
        </ActionBtn>
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
  onDeleteFolder,
  onDeleteRequest,
}: {
  folder: { id: string; name: string; parentFolderId?: string | null }
  allFolders: Array<{ id: string; name: string; parentFolderId?: string | null }>
  allRequests: Array<{ id: string; name: string; method: string; folderId?: string | null }>
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onOpenRequest: (id: string) => void
  onAddRequest: (folderId: string) => void
  onDeleteFolder: (id: string, name: string) => void
  onDeleteRequest: (id: string, name: string) => void
}) {
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
        <div className="hidden shrink-0 items-center gap-0.5 pr-1 group-hover:flex">
          <ActionBtn title="Add request" onClick={() => onAddRequest(folder.id)}>
            <FilePlus size={12} />
          </ActionBtn>
          <ActionBtn
            title="Delete folder"
            onClick={() => onDeleteFolder(folder.id, folder.name)}
            danger
          >
            <Trash2 size={12} />
          </ActionBtn>
        </div>
      </div>

      {isOpen && (
        <div className="ml-3 border-l border-th-border pl-2">
          {childRequests.map(req => (
            <RequestRow
              key={req.id}
              req={req}
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
              onDeleteFolder={onDeleteFolder}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
        </div>
      )}
    </div>
  )
}
