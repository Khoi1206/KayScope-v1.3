import { create } from 'zustand'

export interface WorkspaceVariable {
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

export interface WorkspaceItem {
  id: string
  name: string
  globalVariables: WorkspaceVariable[]
  activeEnvironmentId: string | null
}

interface WorkspaceStore {
  workspace: WorkspaceItem | null
  loading: boolean

  fetchWorkspace: () => Promise<void>
  updateGlobalVariables: (variables: WorkspaceVariable[]) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspace: null,
  loading: false,

  fetchWorkspace: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/workspaces')
      if (!res.ok) return
      const data: WorkspaceItem = await res.json()
      set({ workspace: data, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  updateGlobalVariables: async (variables) => {
    const ws = get().workspace
    if (!ws) return
    const res = await fetch('/api/workspaces', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalVariables: variables }),
    })
    if (!res.ok) throw new Error('Failed to update global variables')
    const updated: WorkspaceItem = await res.json()
    set({ workspace: updated })
  },
}))
