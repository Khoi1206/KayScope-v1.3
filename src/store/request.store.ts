import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useFlowStore } from '@/store/flow.store'
import { getWorkspaceHeaders } from '@/store/workspace.store'

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
  type: 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'graphql'
  content: string
  formData?: KVPair[]
  rawType?: 'text' | 'json' | 'javascript' | 'html' | 'xml'
  graphqlQuery?: string
  graphqlVariables?: string
  graphqlOperationName?: string
}

export interface RequestAuth {
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

export interface ResponseCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: string | null
  httpOnly: boolean
  secure: boolean
  sameSite: string | null
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  size: number
  ttfbMs?: number
  downloadMs?: number
  isBinary?: boolean
  cookies?: ResponseCookie[]
  tests?: Array<{ name: string; passed: boolean; error?: string }>
  logs?: string[]
  preScriptError?: string
  postScriptError?: string
}

export interface RequestSettings {
  timeout: number         // ms, default 30000
  followRedirects: boolean
  maxRedirects: number    // default 10
  sendCookies: boolean    // attach cookie jar cookies to outgoing request, default true
  saveCookies: boolean    // persist Set-Cookie from response into cookie jar, default true
  sslVerify: boolean      // verify TLS certificates, default true
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
  // Per-request settings
  settings?: RequestSettings
  // Local scope overrides
  localScope: Record<string, string>
  // Response (null when not yet sent)
  response: ResponseData | null
  // Loading state
  sending: boolean
}

export interface RequestVersionItem {
  id: string
  workspaceId: string
  requestId: string
  label: string | null
  method: string
  url: string
  params: KVPair[]
  headers: KVPair[]
  body: RequestBody
  auth: RequestAuth
  preRequestScript: string
  postRequestScript: string
  createdBy: string
  createdAt: string
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
  // Per-request saved canvas versions (manual snapshots, restorable)
  versions: Record<string, RequestVersionItem[]>

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

  // Version history
  fetchVersions: (requestId: string) => Promise<void>
  saveVersion: (requestId: string, label: string | undefined, snapshot: TabSnapshot) => Promise<void>
  restoreVersion: (requestId: string, versionId: string) => Promise<{
    method: string; url: string; params: KVPair[]; headers: KVPair[]
    body: RequestBody; auth: RequestAuth; preRequestScript: string; postRequestScript: string
  }>
  deleteVersion: (requestId: string, versionId: string) => Promise<void>

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
      versions: {},

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

      fetchVersions: async (requestId) => {
        try {
          const res = await fetch(`/api/requests/${requestId}/versions`, { headers: getWorkspaceHeaders() })
          const data = await res.json()
          if (!res.ok) return
          set(s => ({ versions: { ...s.versions, [requestId]: data as RequestVersionItem[] } }))
        } catch {
          // Non-critical; silently ignore
        }
      },

      saveVersion: async (requestId, label, snapshot) => {
        const res = await fetch(`/api/requests/${requestId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
          body: JSON.stringify({
            label,
            method: snapshot.method,
            url: snapshot.url,
            params: snapshot.params,
            headers: snapshot.headers,
            body: snapshot.body,
            auth: snapshot.auth,
            preRequestScript: snapshot.preRequestScript,
            postRequestScript: snapshot.postRequestScript,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to save version')
        set(s => ({ versions: { ...s.versions, [requestId]: [json as RequestVersionItem, ...(s.versions[requestId] ?? [])] } }))
      },

      restoreVersion: async (requestId, versionId) => {
        const res = await fetch(`/api/requests/${requestId}/versions/${versionId}/restore`, {
          method: 'POST',
          headers: getWorkspaceHeaders(),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Failed to restore version')
        return {
          method: json.method,
          url: json.url,
          params: json.params ?? [],
          headers: json.headers ?? [],
          body: json.body ?? { type: 'none', content: '' },
          auth: json.auth ?? { type: 'none' },
          preRequestScript: json.preRequestScript ?? '',
          postRequestScript: json.postRequestScript ?? '',
        }
      },

      deleteVersion: async (requestId, versionId) => {
        const res = await fetch(`/api/requests/${requestId}/versions/${versionId}`, { method: 'DELETE', headers: getWorkspaceHeaders() })
        if (!res.ok) {
          const json = await res.json()
          throw new Error(json.error ?? 'Failed to delete version')
        }
        set(s => ({ versions: { ...s.versions, [requestId]: (s.versions[requestId] ?? []).filter(v => v.id !== versionId) } }))
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
