import { create } from 'zustand'

export interface EnvironmentVariable {
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

export interface EnvironmentItem {
  id: string
  workspaceId: string
  name: string
  variables: EnvironmentVariable[]
  createdAt: string
  updatedAt: string
}

interface EnvironmentStore {
  environments: EnvironmentItem[]
  activeEnvironmentId: string | null
  loading: boolean
  error: string | null

  fetchEnvironments: () => Promise<void>
  setActiveEnvironment: (id: string | null) => void

  createEnvironment: (name: string, variables?: EnvironmentVariable[]) => Promise<EnvironmentItem>
  updateEnvironment: (id: string, data: Partial<Pick<EnvironmentItem, 'name' | 'variables'>>) => Promise<void>
  deleteEnvironment: (id: string) => Promise<void>
}

export const useEnvironmentStore = create<EnvironmentStore>((set, get) => ({
  environments: [],
  activeEnvironmentId: null,
  loading: false,
  error: null,

  fetchEnvironments: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/environments')
      if (!res.ok) throw new Error('Failed to fetch environments')
      const data: EnvironmentItem[] = await res.json()
      set({ environments: data, loading: false })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Error', loading: false })
    }
  },

  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  createEnvironment: async (name, variables = []) => {
    const res = await fetch('/api/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, variables }),
    })
    if (!res.ok) throw new Error('Failed to create environment')
    const data: EnvironmentItem = await res.json()
    set(s => ({ environments: [...s.environments, data] }))
    return data
  },

  updateEnvironment: async (id, data) => {
    const res = await fetch(`/api/environments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update environment')
    const updated: EnvironmentItem = await res.json()
    set(s => ({ environments: s.environments.map(e => e.id === id ? updated : e) }))
  },

  deleteEnvironment: async (id) => {
    const res = await fetch(`/api/environments/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete environment')
    set(s => ({
      environments: s.environments.filter(e => e.id !== id),
      activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
    }))
  },
}))
