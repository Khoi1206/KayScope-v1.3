import { create } from 'zustand'
import { getWorkspaceHeaders } from './workspace.store'

export interface CollectionItem {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  variables: Array<{ key: string; value: string; enabled: boolean }>
  preRequestScript?: string
  postRequestScript?: string
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
    type: 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'graphql'
    content?: string
    formData?: Array<{ key: string; value: string; enabled: boolean }>
    rawType?: string
    graphqlQuery?: string
    graphqlVariables?: string
    graphqlOperationName?: string
  }
  auth?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'oauth1' | 'aws-sig-v4'
    token?: string
    username?: string
    password?: string
    apiKey?: string
    apiKeyHeader?: string
    oauth2GrantType?: 'client_credentials' | 'password' | 'authorization_code'
    oauth2TokenUrl?: string
    oauth2ClientId?: string
    oauth2ClientSecret?: string
    oauth2Scope?: string
    oauth2ClientAuth?: 'body' | 'basic_header'
    oauth2Username?: string
    oauth2Password?: string
    oauth2AuthUrl?: string
    oauth2RedirectUri?: string
    oauth1ConsumerKey?: string
    oauth1ConsumerSecret?: string
    oauth1Token?: string
    oauth1TokenSecret?: string
    oauth1SignatureMethod?: 'HMAC-SHA1' | 'HMAC-SHA256'
    oauth1Realm?: string
    awsAccessKeyId?: string
    awsSecretAccessKey?: string
    awsSessionToken?: string
    awsRegion?: string
    awsService?: string
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
  updateCollection: (id: string, data: Partial<Pick<CollectionItem, 'name' | 'description' | 'variables' | 'preRequestScript' | 'postRequestScript'>>) => Promise<void>
  deleteCollection: (id: string) => Promise<void>

  createFolder: (collectionId: string, name: string, parentFolderId?: string) => Promise<FolderItem>
  updateFolder: (id: string, collectionId: string, name: string) => Promise<void>
  moveFolderToParent: (folderId: string, collectionId: string, newParentFolderId: string | null) => Promise<void>
  deleteFolder: (id: string, collectionId: string) => Promise<void>

  createRequest: (collectionId: string, name: string, folderId?: string) => Promise<RequestItem>
  duplicateRequest: (id: string, collectionId: string) => Promise<RequestItem>
  deleteRequest: (id: string, collectionId: string) => Promise<void>
  renameRequest: (id: string, collectionId: string, name: string) => void
  patchRequest: (id: string, collectionId: string, patch: Partial<RequestItem>) => void

  reorderCollections: (ids: string[]) => Promise<void>
  reorderFolders: (collectionId: string, ids: string[]) => Promise<void>
  reorderRequests: (collectionId: string, ids: string[]) => Promise<void>
  moveRequest: (requestId: string, collectionId: string, newFolderId: string | null) => Promise<void>

  /** Reset all loaded data — called when switching workspace */
  reset: () => void
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
      const res = await fetch('/api/collections', {
        headers: getWorkspaceHeaders(),
      })
      if (!res.ok) throw new Error('Failed to fetch collections')
      const data: CollectionItem[] = await res.json()
      set({ collections: data, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Error', loading: false })
    }
  },

  fetchFolders: async (collectionId) => {
    try {
      const res = await fetch(`/api/folders?collectionId=${collectionId}`, {
        headers: getWorkspaceHeaders(),
      })
      if (!res.ok) return
      const data: FolderItem[] = await res.json()
      set(s => ({ folders: { ...s.folders, [collectionId]: data } }))
    } catch { /* silent */ }
  },

  fetchRequests: async (collectionId) => {
    try {
      const res = await fetch(`/api/requests?collectionId=${collectionId}`, {
        headers: getWorkspaceHeaders(),
      })
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
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update collection')
    const updated: CollectionItem = await res.json()
    set(s => ({ collections: s.collections.map(c => c.id === id ? updated : c) }))
  },

  deleteCollection: async (id) => {
    const res = await fetch(`/api/collections/${id}`, {
      method: 'DELETE',
      headers: getWorkspaceHeaders(),
    })
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
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
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

  moveFolderToParent: async (folderId, collectionId, newParentFolderId) => {
    const folder = get().folders[collectionId]?.find(f => f.id === folderId)
    if (!folder) return
    // Optimistic update
    set(s => ({
      folders: {
        ...s.folders,
        [collectionId]: (s.folders[collectionId] ?? []).map(f =>
          f.id === folderId ? { ...f, parentFolderId: newParentFolderId } : f
        ),
      },
    }))
    const res = await fetch(`/api/folders/${folderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ name: folder.name, parentFolderId: newParentFolderId }),
    })
    if (!res.ok) {
      // Rollback on failure
      set(s => ({
        folders: {
          ...s.folders,
          [collectionId]: (s.folders[collectionId] ?? []).map(f =>
            f.id === folderId ? { ...f, parentFolderId: folder.parentFolderId } : f
          ),
        },
      }))
    }
  },

  deleteFolder: async (id, collectionId) => {
    const res = await fetch(`/api/folders/${id}`, {
      method: 'DELETE',
      headers: getWorkspaceHeaders(),
    })
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
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
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

  duplicateRequest: async (id, collectionId) => {
    const source = get().requests[collectionId]?.find(r => r.id === id)
    if (!source) throw new Error('Request not found')
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({
        collectionId,
        folderId: source.folderId,
        name: `${source.name} (copy)`,
        method: source.method,
        url: source.url,
        params: source.params,
        headers: source.headers,
        body: source.body,
        auth: source.auth,
        preRequestScript: source.preRequestScript,
        postRequestScript: source.postRequestScript,
      }),
    })
    if (!res.ok) throw new Error('Failed to duplicate request')
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
    const res = await fetch(`/api/requests/${id}`, {
      method: 'DELETE',
      headers: getWorkspaceHeaders(),
    })
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

  reorderCollections: async (ids) => {
    const items = ids.map((id, i) => ({ id, sortOrder: i }))
    set(s => ({ collections: ids.map(id => s.collections.find(c => c.id === id)!).filter(Boolean) }))
    await fetch('/api/collections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ items }),
    })
  },

  reorderFolders: async (collectionId, ids) => {
    const items = ids.map((id, i) => ({ id, sortOrder: i }))
    set(s => {
      const all = s.folders[collectionId] ?? []
      const idSet = new Set(ids)
      const reordered = ids.map(id => all.find(f => f.id === id)!).filter(Boolean)
      const others = all.filter(f => !idSet.has(f.id))
      return { folders: { ...s.folders, [collectionId]: [...reordered, ...others] } }
    })
    await fetch('/api/folders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ collectionId, items }),
    })
  },

  reorderRequests: async (collectionId, ids) => {
    const items = ids.map((id, i) => ({ id, sortOrder: i }))
    set(s => {
      const all = s.requests[collectionId] ?? []
      const idSet = new Set(ids)
      const reordered = ids.map(id => all.find(r => r.id === id)!).filter(Boolean)
      const others = all.filter(r => !idSet.has(r.id))
      return { requests: { ...s.requests, [collectionId]: [...reordered, ...others] } }
    })
    await fetch('/api/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ collectionId, items }),
    })
  },

  moveRequest: async (requestId, collectionId, newFolderId) => {
    const req = get().requests[collectionId]?.find(r => r.id === requestId)
    if (!req) return
    // Optimistic update
    set(s => ({
      requests: {
        ...s.requests,
        [collectionId]: (s.requests[collectionId] ?? []).map(r =>
          r.id === requestId ? { ...r, folderId: newFolderId } : r
        ),
      },
    }))
    const res = await fetch(`/api/requests/${requestId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ name: req.name, folderId: newFolderId, method: req.method, url: req.url }),
    })
    if (!res.ok) {
      // Rollback
      set(s => ({
        requests: {
          ...s.requests,
          [collectionId]: (s.requests[collectionId] ?? []).map(r =>
            r.id === requestId ? { ...r, folderId: req.folderId } : r
          ),
        },
      }))
    }
  },

  reset: () => set({ collections: [], folders: {}, requests: {}, expanded: {}, error: null }),
}))
