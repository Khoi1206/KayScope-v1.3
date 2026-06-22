import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useFlowStore } from '@/store/flow.store'

// ── Types ──────────────────────────────────────────────────────────────────

export interface KVPair {
  key: string
  value: string           // text value OR uploadId when type === 'file'
  enabled: boolean
  description?: string
  type?: 'text' | 'file'
  fileName?: string       // original filename for display and Blob filename
  fileMimeType?: string   // MIME type for Blob construction
}

export interface RequestBody {
  type: 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded'
  content: string
  formData?: KVPair[]
  rawType?: 'text' | 'json' | 'javascript' | 'html' | 'xml'
}

export interface RequestAuth {
  type: 'none' | 'bearer' | 'basic' | 'api-key'
  token?: string
  username?: string
  password?: string
  apiKey?: string
  apiKeyHeader?: string
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  size: number
  tests?: Array<{ name: string; passed: boolean; error?: string }>
  logs?: string[]
  preScriptError?: string
  postScriptError?: string
}

export interface TabSnapshot {
  // Request fields
  method: string
  url: string
  params: KVPair[]
  headers: KVPair[]
  body: RequestBody
  auth: RequestAuth
  preRequestScript: string
  postRequestScript: string
  // Local scope overrides
  localScope: Record<string, string>
  // Response (null when not yet sent)
  response: ResponseData | null
  // Loading state
  sending: boolean
}

export interface TabMeta {
  id: string
  title: string
  /** If derived from a saved request, this is the request ID */
  requestId?: string
  collectionId?: string
  isDirty: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function defaultSnapshot(): TabSnapshot {
  return {
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    preRequestScript: '',
    postRequestScript: '',
    localScope: {},
    response: null,
    sending: false,
  }
}

// ── Store ──────────────────────────────────────────────────────────────────

interface RequestStore {
  tabs: TabMeta[]
  snapshots: Record<string, TabSnapshot>
  activeTabId: string | null

  // Tab management
  openTab: (meta: Partial<TabMeta> & { id: string }, snapshot?: Partial<TabSnapshot>) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateSnapshot: (id: string, patch: Partial<TabSnapshot>) => void
  markDirty: (id: string) => void
  markClean: (id: string) => void
  renameTab: (id: string, title: string) => void

  // Persistence
  saveRequest: (tabId: string) => Promise<void>
  attachRequest: (tabId: string, requestId: string, collectionId: string, title?: string) => void

  // Convenience
  activeSnapshot: () => TabSnapshot | null

  // Per-workspace tab persistence
  saveTabsForWorkspace: (workspaceId: string) => void
  loadTabsForWorkspace: (workspaceId: string) => void
}

let tabCounter = 0

export const useRequestStore = create<RequestStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      snapshots: {},
      activeTabId: null,

      openTab: (meta, snapshot) => {
        // Opening a request tab dismisses the flow canvas
        useFlowStore.getState().setActiveFlow(null)
        const existing = get().tabs.find(t => t.id === meta.id)
        if (existing) {
          set({ activeTabId: meta.id })
          return
        }
        // A saved request tab may have been created before the DB ID was known
        // (e.g. saved from a "New Request" tab whose tab.id ≠ requestId).
        if (meta.requestId) {
          const byReqId = get().tabs.find(t => t.requestId === meta.requestId)
          if (byReqId) {
            set({ activeTabId: byReqId.id })
            return
          }
        }
        const title = meta.title ?? `Request ${++tabCounter}`
        const newTab: TabMeta = {
          id: meta.id,
          title,
          requestId: meta.requestId,
          collectionId: meta.collectionId,
          isDirty: false,
        }
        set(s => ({
          tabs: [...s.tabs, newTab],
          snapshots: {
            ...s.snapshots,
            [meta.id]: { ...defaultSnapshot(), ...(snapshot ?? {}) },
          },
          activeTabId: meta.id,
        }))
      },

      closeTab: (id) => {
        set(s => {
          const tabs = s.tabs.filter(t => t.id !== id)
          const snapshots = { ...s.snapshots }
          delete snapshots[id]
          const activeTabId =
            s.activeTabId === id
              ? (tabs[tabs.length - 1]?.id ?? null)
              : s.activeTabId
          return { tabs, snapshots, activeTabId }
        })
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateSnapshot: (id, patch) => {
        const DIRTY_FIELDS = new Set([
          'method', 'url', 'params', 'headers', 'body', 'auth', 'preRequestScript', 'postRequestScript',
        ])
        const triggeredDirty = Object.keys(patch).some(k => DIRTY_FIELDS.has(k))
        set(s => {
          const tab = s.tabs.find(t => t.id === id)
          const shouldMarkDirty = triggeredDirty && !tab?.isDirty
          return {
            snapshots: {
              ...s.snapshots,
              [id]: { ...(s.snapshots[id] ?? defaultSnapshot()), ...patch },
            },
            tabs: shouldMarkDirty
              ? s.tabs.map(t => t.id === id ? { ...t, isDirty: true } : t)
              : s.tabs,
          }
        })
      },

      markDirty: (id) => {
        set(s => ({
          tabs: s.tabs.map(t => t.id === id ? { ...t, isDirty: true } : t),
        }))
      },

      markClean: (id) => {
        set(s => ({
          tabs: s.tabs.map(t => t.id === id ? { ...t, isDirty: false } : t),
        }))
      },

      renameTab: (id, title) => {
        set(s => ({
          tabs: s.tabs.map(t =>
            t.id === id
              ? { ...t, title, isDirty: t.isDirty || !!t.requestId }
              : t
          ),
        }))
      },

      attachRequest: (tabId, requestId, collectionId, title) => {
        set(s => ({
          tabs: s.tabs.map(t =>
            t.id === tabId
              ? { ...t, requestId, collectionId, isDirty: false, ...(title !== undefined ? { title } : {}) }
              : t
          ),
        }))
      },

      saveRequest: async (tabId) => {
        const tab = get().tabs.find(t => t.id === tabId)
        const snap = get().snapshots[tabId]
        if (!tab?.requestId || !snap) throw new Error('No saved request to update')
        const res = await fetch(`/api/requests/${tab.requestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tab.title,
            method: snap.method,
            url: snap.url,
            params: snap.params,
            headers: snap.headers,
            body: snap.body,
            auth: snap.auth,
            preRequestScript: snap.preRequestScript,
            postRequestScript: snap.postRequestScript,
          }),
        })
        if (!res.ok) throw new Error('Failed to save request')
        get().markClean(tabId)
      },

      activeSnapshot: () => {
        const id = get().activeTabId
        return id ? (get().snapshots[id] ?? null) : null
      },

      saveTabsForWorkspace: (workspaceId) => {
        if (typeof window === 'undefined') return
        const { tabs, activeTabId, snapshots } = get()
        const data = {
          tabs,
          activeTabId,
          snapshots: Object.fromEntries(
            Object.entries(snapshots).map(([id, snap]) => [
              id,
              { ...snap, response: null, sending: false },
            ])
          ),
        }
        localStorage.setItem(`kayscope-tabs-${workspaceId}`, JSON.stringify(data))
      },

      loadTabsForWorkspace: (workspaceId) => {
        if (typeof window === 'undefined') return
        try {
          // Migration: on first load, seed from the legacy global key if workspace key is empty
          const legacyKey = 'kayscope-tabs'
          const wsKey = `kayscope-tabs-${workspaceId}`
          if (!localStorage.getItem(wsKey)) {
            const legacy = localStorage.getItem(legacyKey)
            if (legacy) {
              localStorage.setItem(wsKey, legacy)
              localStorage.removeItem(legacyKey)
            }
          }
          const raw = localStorage.getItem(wsKey)
          if (raw) {
            const parsed = JSON.parse(raw) as { tabs?: TabMeta[]; activeTabId?: string | null; snapshots?: Record<string, TabSnapshot> }
            set({
              tabs: parsed.tabs ?? [],
              activeTabId: parsed.activeTabId ?? null,
              snapshots: parsed.snapshots ?? {},
            })
            return
          }
        } catch { /* ignore */ }
        set({ tabs: [], activeTabId: null, snapshots: {} })
      },
    }),
    {
      name: 'kayscope-tabs',
      storage: createJSONStorage(() => localStorage),
      // Don't persist transient UI state (response, sending)
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        snapshots: Object.fromEntries(
          Object.entries(state.snapshots).map(([id, snap]) => [
            id,
            { ...snap, response: null, sending: false },
          ])
        ),
      }),
    }
  )
)
