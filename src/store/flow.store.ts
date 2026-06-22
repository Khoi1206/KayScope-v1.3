'use client'

import { create } from 'zustand'
import type { FlowNode, FlowEdge, PlaywrightRunResult, FlowRunSummary, FlowBrowser } from '@/db/schema'
import { getWorkspaceHeaders } from './workspace.store'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlowItem {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  browsers: FlowBrowser[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface FlowRunSummaryItem {
  id: string
  workspaceId: string
  flowId: string
  flowName: string
  status: 'running' | 'passed' | 'failed' | 'errored'
  summary: FlowRunSummary
  triggeredBy: string
  createdAt: string
  finishedAt?: string | null
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface FlowStore {
  flows: FlowItem[]
  loading: boolean
  error: string | null

  // Which flow is open in the canvas editor
  activeFlowId: string | null

  // Running state
  runningId: string | null
  runResult: PlaywrightRunResult | null
  runRecord: FlowRunSummaryItem | null
  runError: string | null

  // Playwright UI mode
  openingUiId: string | null

  // Per-flow run history cache
  recentRuns: Record<string, FlowRunSummaryItem[]>

  // Modal state: undefined = closed, null = create new, FlowItem = edit
  editingFlow: FlowItem | null | undefined

  // Actions
  fetchFlows: () => Promise<void>
  createFlow: (data: { name: string; description?: string }) => Promise<FlowItem>
  updateFlow: (id: string, data: Partial<{ name: string; description: string | null; browsers: FlowBrowser[] }>) => Promise<void>
  deleteFlow: (id: string) => Promise<void>
  setActiveFlow: (id: string | null) => void
  saveCanvas: (id: string, nodes: FlowNode[], edges: FlowEdge[]) => Promise<void>
  runFlow: (flowId: string) => Promise<void>
  openUi: (flowId: string) => Promise<void>
  resetRun: () => void
  fetchRecentRuns: (flowId: string) => Promise<void>
  openEdit: (flow: FlowItem | null) => void
  closeEdit: () => void

  // Optimistic canvas update (updates local store without API call)
  updateCanvas: (id: string, nodes: FlowNode[], edges: FlowEdge[]) => void
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  flows: [],
  loading: false,
  error: null,
  activeFlowId: null,
  runningId: null,
  runResult: null,
  runRecord: null,
  runError: null,
  openingUiId: null,
  recentRuns: {},
  editingFlow: undefined,

  fetchFlows: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/flows', { headers: getWorkspaceHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load flows')
      set({ flows: data as FlowItem[], loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error', loading: false })
    }
  },

  createFlow: async (data) => {
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ ...data, nodes: [], edges: [] }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to create flow')
    const flow = json as FlowItem
    set(s => ({ flows: [flow, ...s.flows], activeFlowId: flow.id }))
    return flow
  },

  updateFlow: async (id, data) => {
    const res = await fetch(`/api/flows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to update flow')
    set(s => ({ flows: s.flows.map(f => f.id === id ? { ...f, ...json } : f) }))
  },

  deleteFlow: async (id) => {
    const res = await fetch(`/api/flows/${id}`, { method: 'DELETE', headers: getWorkspaceHeaders() })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Failed to delete flow')
    }
    set(s => ({
      flows: s.flows.filter(f => f.id !== id),
      activeFlowId: s.activeFlowId === id ? null : s.activeFlowId,
      recentRuns: Object.fromEntries(Object.entries(s.recentRuns).filter(([k]) => k !== id)),
    }))
  },

  setActiveFlow: (id) => set({ activeFlowId: id, runResult: null, runRecord: null, runError: null }),

  saveCanvas: async (id, nodes, edges) => {
    await fetch(`/api/flows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ nodes, edges }),
    })
    // Update local store too
    set(s => ({ flows: s.flows.map(f => f.id === id ? { ...f, nodes, edges } : f) }))
  },

  updateCanvas: (id, nodes, edges) => {
    set(s => ({ flows: s.flows.map(f => f.id === id ? { ...f, nodes, edges } : f) }))
  },

  runFlow: async (flowId) => {
    set({ runningId: flowId, runResult: null, runRecord: null, runError: null })
    try {
      const res = await fetch(`/api/flows/${flowId}/run`, { method: 'POST', headers: getWorkspaceHeaders() })
      const data = await res.json()
      if (!res.ok) {
        set({ runError: data.error ?? 'Run failed', runningId: null })
        return
      }
      const { run, testResults } = data as { run: FlowRunSummaryItem; testResults: PlaywrightRunResult }
      set(s => ({
        runningId: null,
        runResult: testResults,
        runRecord: run,
        recentRuns: {
          ...s.recentRuns,
          [flowId]: [run, ...(s.recentRuns[flowId] ?? [])].slice(0, 10),
        },
      }))
    } catch (err) {
      set({ runError: err instanceof Error ? err.message : 'Network error', runningId: null })
    }
  },

  openUi: async (flowId) => {
    set({ openingUiId: flowId })
    try {
      await fetch(`/api/flows/${flowId}/ui`, { method: 'POST', headers: getWorkspaceHeaders() })
    } finally {
      set({ openingUiId: null })
    }
  },

  resetRun: () => set({ runResult: null, runRecord: null, runError: null }),

  fetchRecentRuns: async (flowId) => {
    try {
      const res = await fetch(`/api/flows/${flowId}/runs?limit=10`, { headers: getWorkspaceHeaders() })
      const data = await res.json()
      if (!res.ok) return
      set(s => ({ recentRuns: { ...s.recentRuns, [flowId]: data as FlowRunSummaryItem[] } }))
    } catch {
      // Non-critical; silently ignore
    }
  },

  openEdit: (flow) => set({ editingFlow: flow }),
  closeEdit: () => set({ editingFlow: undefined }),
}))
