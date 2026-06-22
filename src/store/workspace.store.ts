'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { WorkspaceType } from '@/db/schema'

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkspaceVariable {
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

/** Lightweight list item — returned by GET /api/workspaces */
export interface WorkspaceListItem {
  id: string
  name: string
  type: WorkspaceType
  description: string | null
  createdAt: string
}

/** Full workspace with global vars — returned by GET /api/workspaces/[id] */
export interface WorkspaceItem extends WorkspaceListItem {
  globalVariables: WorkspaceVariable[]
  activeEnvironmentId: string | null
}

// ── Store ──────────────────────────────────────────────────────────────────

interface WorkspaceStore {
  /** All workspaces the user owns */
  workspaces: WorkspaceListItem[]
  workspacesLoading: boolean

  /** The currently active workspace (with global vars) */
  activeWorkspaceId: string | null
  workspace: WorkspaceItem | null
  loading: boolean

  fetchWorkspaces: () => Promise<void>
  fetchWorkspace: () => Promise<void>
  switchWorkspace: (id: string) => Promise<void>
  createWorkspace: (name: string, type: WorkspaceType, description?: string) => Promise<WorkspaceListItem>
  renameWorkspace: (id: string, data: { name?: string; type?: WorkspaceType; description?: string | null }) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  updateGlobalVariables: (variables: WorkspaceVariable[]) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      workspacesLoading: false,
      activeWorkspaceId: null,
      workspace: null,
      loading: false,

      fetchWorkspaces: async () => {
        set({ workspacesLoading: true })
        try {
          const res = await fetch('/api/workspaces')
          if (!res.ok) return
          const data: WorkspaceListItem[] = await res.json()
          set({ workspaces: data, workspacesLoading: false })

          // Auto-select first workspace if none is set or the saved one is gone
          const current = get().activeWorkspaceId
          const stillExists = data.some(w => w.id === current)
          if (!stillExists && data.length > 0) {
            set({ activeWorkspaceId: data[0]!.id })
          }
        } catch {
          set({ workspacesLoading: false })
        }
      },

      fetchWorkspace: async () => {
        const id = get().activeWorkspaceId
        if (!id) return
        set({ loading: true })
        try {
          const res = await fetch(`/api/workspaces/${id}`, {
            headers: getWorkspaceHeaders(),
          })
          if (!res.ok) return
          const data: WorkspaceItem = await res.json()
          set({ workspace: data, loading: false })
        } catch {
          set({ loading: false })
        }
      },

      switchWorkspace: async (id: string) => {
        if (id === get().activeWorkspaceId) return
        set({ activeWorkspaceId: id, workspace: null })
        // Dispatch a DOM event so WorkspaceShell can save/load tabs
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('workspace:switched', { detail: { id } }))
        }
        await get().fetchWorkspace()
      },

      createWorkspace: async (name, type, description) => {
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type, description }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'Failed to create workspace')
        }
        const created: WorkspaceListItem = await res.json()
        set(s => ({ workspaces: [...s.workspaces, created] }))
        await get().switchWorkspace(created.id)
        return created
      },

      renameWorkspace: async (id, data) => {
        const res = await fetch(`/api/workspaces/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Failed to update workspace')
        const updated: WorkspaceListItem = await res.json()
        set(s => ({
          workspaces: s.workspaces.map(w => w.id === id ? { ...w, ...updated } : w),
          workspace: s.workspace?.id === id ? { ...s.workspace, ...updated } : s.workspace,
        }))
      },

      deleteWorkspace: async (id: string) => {
        const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? 'Failed to delete workspace')
        }
        const remaining = get().workspaces.filter(w => w.id !== id)
        const nextId = remaining[0]?.id ?? null
        set({ workspaces: remaining })
        if (get().activeWorkspaceId === id && nextId) {
          await get().switchWorkspace(nextId)
        }
      },

      updateGlobalVariables: async (variables) => {
        const id = get().activeWorkspaceId
        const ws = get().workspace
        if (!id || !ws) throw new Error('Workspace not loaded')
        const res = await fetch(`/api/workspaces/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
          body: JSON.stringify({ globalVariables: variables }),
        })
        if (!res.ok) throw new Error('Failed to update global variables')
        const updated: WorkspaceItem = await res.json()
        set({ workspace: updated })
      },
    }),
    {
      name: 'kayscope-workspace',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as Storage))),
      partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId }),
    }
  )
)

// ── Shared header utility ──────────────────────────────────────────────────

/**
 * Returns `{ 'X-Workspace-Id': id }` for the currently active workspace.
 * Import this in every store/component that makes API calls needing workspace context.
 */
export function getWorkspaceHeaders(): Record<string, string> {
  const id = useWorkspaceStore.getState().activeWorkspaceId
  return id ? { 'X-Workspace-Id': id } : {}
}
