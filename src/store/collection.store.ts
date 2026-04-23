import { create } from 'zustand'

export interface CollectionItem {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  variables: Array<{ key: string; value: string; enabled: boolean }>
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface FolderItem {
  id: string
  collectionId: string
  parentFolderId?: string | null
  name: string
  sortOrder: number
}

export interface RequestItem {
  id: string
  collectionId: string
  folderId?: string | null
  name: string
  method: string
  url: string
  sortOrder: number
  params?: Array<{ key: string; value: string; enabled: boolean }>
  headers?: Array<{ key: string; value: string; enabled: boolean }>
  body?: {
    type: 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded'
    content?: string
    formData?: Array<{ key: string; value: string; enabled: boolean }>
    rawType?: string
  }
  auth?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key'
    token?: string
    username?: string
    password?: string
    apiKey?: string
    apiKeyHeader?: string
  }
  preRequestScript?: string
  postRequestScript?: string
}

interface CollectionStore {
  collections: CollectionItem[]
  folders: Record<string, FolderItem[]>   // keyed by collectionId
  requests: Record<string, RequestItem[]> // keyed by collectionId
  expanded: Record<string, boolean>       // collectionId or folderId → open
  loading: boolean
  error: string | null

  // Actions
  fetchCollections: () => Promise<void>
  fetchFolders: (collectionId: string) => Promise<void>
  fetchRequests: (collectionId: string) => Promise<void>
  toggleExpanded: (id: string) => void
  setExpanded: (id: string, open: boolean) => void

  createCollection: (name: string, description?: string) => Promise<CollectionItem>
  updateCollection: (id: string, data: Partial<Pick<CollectionItem, 'name' | 'description' | 'variables'>>) => Promise<void>
  deleteCollection: (id: string) => Promise<void>

  createFolder: (collectionId: string, name: string, parentFolderId?: string) => Promise<FolderItem>
  updateFolder: (id: string, collectionId: string, name: string) => Promise<void>
  deleteFolder: (id: string, collectionId: string) => Promise<void>

  createRequest: (collectionId: string, name: string, folderId?: string) => Promise<RequestItem>
  deleteRequest: (id: string, collectionId: string) => Promise<void>
  renameRequest: (id: string, collectionId: string, name: string) => void
  patchRequest: (id: string, collectionId: string, patch: Partial<Pick<RequestItem, 'name' | 'method' | 'url'>>) => void
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  folders: {},
  requests: {},
  expanded: {},
  loading: false,
  error: null,

  fetchCollections: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/collections')
      if (!res.ok) throw new Error('Failed to fetch collections')
      const data: CollectionItem[] = await res.json()
      set({ collections: data, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Error', loading: false })
    }
  },

  fetchFolders: async (collectionId) => {
    try {
      const res = await fetch(`/api/folders?collectionId=${collectionId}`)
      if (!res.ok) return
      const data: FolderItem[] = await res.json()
      set(s => ({ folders: { ...s.folders, [collectionId]: data } }))
    } catch { /* silent */ }
  },

  fetchRequests: async (collectionId) => {
    try {
      const res = await fetch(`/api/requests?collectionId=${collectionId}`)
      if (!res.ok) return
      const data: RequestItem[] = await res.json()
      set(s => ({ requests: { ...s.requests, [collectionId]: data } }))
    } catch { /* silent */ }
  },

  toggleExpanded: (id) => set(s => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
  setExpanded: (id, open) => set(s => ({ expanded: { ...s.expanded, [id]: open } })),

  createCollection: async (name, description) => {
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) throw new Error('Failed to create collection')
    const data: CollectionItem = await res.json()
    set(s => ({ collections: [...s.collections, data] }))
    return data
  },

  updateCollection: async (id, data) => {
    const res = await fetch(`/api/collections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update collection')
    const updated: CollectionItem = await res.json()
    set(s => ({ collections: s.collections.map(c => c.id === id ? updated : c) }))
  },

  deleteCollection: async (id) => {
    const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete collection')
    set(s => ({
      collections: s.collections.filter(c => c.id !== id),
      folders: Object.fromEntries(Object.entries(s.folders).filter(([k]) => k !== id)),
      requests: Object.fromEntries(Object.entries(s.requests).filter(([k]) => k !== id)),
    }))
  },

  createFolder: async (collectionId, name, parentFolderId) => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, name, parentFolderId }),
    })
    if (!res.ok) throw new Error('Failed to create folder')
    const data: FolderItem = await res.json()
    set(s => ({
      folders: {
        ...s.folders,
        [collectionId]: [...(s.folders[collectionId] ?? []), data],
      },
    }))
    return data
  },

  updateFolder: async (id, collectionId, name) => {
    const res = await fetch(`/api/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error('Failed to update folder')
    const updated: FolderItem = await res.json()
    set(s => ({
      folders: {
        ...s.folders,
        [collectionId]: (s.folders[collectionId] ?? []).map(f => f.id === id ? updated : f),
      },
    }))
  },

  deleteFolder: async (id, collectionId) => {
    const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete folder')
    set(s => ({
      folders: {
        ...s.folders,
        [collectionId]: (s.folders[collectionId] ?? []).filter(f => f.id !== id),
      },
    }))
  },

  createRequest: async (collectionId, name, folderId) => {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, name, folderId }),
    })
    if (!res.ok) throw new Error('Failed to create request')
    const data: RequestItem = await res.json()
    set(s => ({
      requests: {
        ...s.requests,
        [collectionId]: [...(s.requests[collectionId] ?? []), data],
      },
    }))
    return data
  },

  deleteRequest: async (id, collectionId) => {
    const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete request')
    set(s => ({
      requests: {
        ...s.requests,
        [collectionId]: (s.requests[collectionId] ?? []).filter(r => r.id !== id),
      },
    }))
  },

  renameRequest: (id, collectionId, name) => {
    set(s => ({
      requests: {
        ...s.requests,
        [collectionId]: (s.requests[collectionId] ?? []).map(r =>
          r.id === id ? { ...r, name } : r
        ),
      },
    }))
  },

  patchRequest: (id, collectionId, patch) => {
    set(s => ({
      requests: {
        ...s.requests,
        [collectionId]: (s.requests[collectionId] ?? []).map(r =>
          r.id === id ? { ...r, ...patch } : r
        ),
      },
    }))
  },
}))
