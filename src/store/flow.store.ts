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
  environmentId?: string | null
  timeoutMs: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface FlowVersionItem {
  id: string
  workspaceId: string
  flowId: string
  label: string | null
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdBy: string
  createdAt: string
}

export interface FlowRunSummaryItem {
  id: string
  workspaceId: string
  flowId: string
  flowName: string
  status: 'running' | 'passed' | 'failed' | 'errored' | 'timedOut'
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
  // flowIds with a live "Test UI" (Playwright UI mode) process running server-side
  runningUiIds: string[]

  // Per-flow run history cache
  recentRuns: Record<string, FlowRunSummaryItem[]>

  // Per-flow saved canvas versions (manual snapshots, restorable)
  versions: Record<string, FlowVersionItem[]>

  // Modal state: undefined = closed, null = create new, FlowItem = edit
  editingFlow: FlowItem | null | undefined

  // Actions
  fetchFlows: () => Promise<void>
  createFlow: (data: { name: string; description?: string }) => Promise<FlowItem>
  updateFlow: (id: string, data: Partial<{ name: string; description: string | null; browsers: FlowBrowser[]; environmentId: string | null; timeoutMs: number }>) => Promise<void>
  deleteFlow: (id: string) => Promise<void>
  setActiveFlow: (id: string | null) => void
  saveCanvas: (id: string, nodes: FlowNode[], edges: FlowEdge[]) => Promise<void>
  runFlow: (flowId: string) => Promise<void>
  pollQueuedRun: (flowId: string, runId: string) => Promise<void>
  openUi: (flowId: string) => Promise<void>
  stopUi: (flowId: string) => Promise<void>
  checkUiStatus: (flowId: string) => Promise<void>
  resetRun: () => void
  fetchRecentRuns: (flowId: string) => Promise<void>
  fetchVersions: (flowId: string) => Promise<void>
  saveVersion: (flowId: string, label: string | undefined, nodes: FlowNode[], edges: FlowEdge[]) => Promise<void>
  restoreVersion: (flowId: string, versionId: string) => Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }>
  deleteVersion: (flowId: string, versionId: string) => Promise<void>
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
  runningUiIds: [],
  recentRuns: {},
  versions: {},
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
      // Production hands the run to a background worker queue and returns
      // immediately (see flow-run-queue.ts) — poll the run record instead of
      // expecting testResults in this response.
      if (data.queued) {
        const run = data.run as FlowRunSummaryItem
        await get().pollQueuedRun(flowId, run.id)
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

  pollQueuedRun: async (flowId, runId) => {
    const POLL_INTERVAL_MS = 2000
    // Ceiling comfortably above the max per-flow run timeout (10 min) plus queue wait time.
    const MAX_POLLS = 250
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      try {
        const res = await fetch(`/api/flow-runs/${runId}`, { headers: getWorkspaceHeaders() })
        if (!res.ok) continue
        const run = (await res.json()) as FlowRunSummaryItem & { testResults: PlaywrightRunResult | null }
        if (run.status !== 'running') {
          set(s => ({
            runningId: null,
            runResult: run.testResults,
            runRecord: run,
            recentRuns: { ...s.recentRuns, [flowId]: [run, ...(s.recentRuns[flowId] ?? [])].slice(0, 10) },
          }))
          return
        }
      } catch {
        // Transient network hiccup — keep polling
      }
    }
    set({ runError: 'Run is taking longer than expected — check Flow Run History for the result.', runningId: null })
  },

  openUi: async (flowId) => {
    set({ openingUiId: flowId })
    try {
      const res = await fetch(`/api/flows/${flowId}/ui`, { method: 'POST', headers: getWorkspaceHeaders() })
      const data = await res.json().catch(() => ({}))
      // Either we just started a session, or one was already running (409) —
      // both mean a Stop button should be shown for this flow.
      if (res.ok || data.alreadyRunning) {
        set(s => ({ runningUiIds: s.runningUiIds.includes(flowId) ? s.runningUiIds : [...s.runningUiIds, flowId] }))
      }
    } finally {
      set({ openingUiId: null })
    }
  },

  stopUi: async (flowId) => {
    try {
      await fetch(`/api/flows/${flowId}/ui`, { method: 'DELETE', headers: getWorkspaceHeaders() })
    } finally {
      set(s => ({ runningUiIds: s.runningUiIds.filter(id => id !== flowId) }))
    }
  },

  checkUiStatus: async (flowId) => {
    try {
      const res = await fetch(`/api/flows/${flowId}/ui`, { headers: getWorkspaceHeaders() })
      const data = await res.json()
      set(s => ({
        runningUiIds: data.running
          ? (s.runningUiIds.includes(flowId) ? s.runningUiIds : [...s.runningUiIds, flowId])
          : s.runningUiIds.filter(id => id !== flowId),
      }))
    } catch {
      // Non-critical; leave state as-is
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

  fetchVersions: async (flowId) => {
    try {
      const res = await fetch(`/api/flows/${flowId}/versions`, { headers: getWorkspaceHeaders() })
      const data = await res.json()
      if (!res.ok) return
      set(s => ({ versions: { ...s.versions, [flowId]: data as FlowVersionItem[] } }))
    } catch {
      // Non-critical; silently ignore
    }
  },

  saveVersion: async (flowId, label, nodes, edges) => {
    const res = await fetch(`/api/flows/${flowId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify({ label, nodes, edges }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to save version')
    set(s => ({ versions: { ...s.versions, [flowId]: [json as FlowVersionItem, ...(s.versions[flowId] ?? [])] } }))
  },

  restoreVersion: async (flowId, versionId) => {
    const res = await fetch(`/api/flows/${flowId}/versions/${versionId}/restore`, {
      method: 'POST',
      headers: getWorkspaceHeaders(),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to restore version')
    const updated = json as FlowItem
    set(s => ({ flows: s.flows.map(f => f.id === flowId ? { ...f, nodes: updated.nodes, edges: updated.edges } : f) }))
    return { nodes: updated.nodes, edges: updated.edges }
  },

  deleteVersion: async (flowId, versionId) => {
    const res = await fetch(`/api/flows/${flowId}/versions/${versionId}`, { method: 'DELETE', headers: getWorkspaceHeaders() })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Failed to delete version')
    }
    set(s => ({ versions: { ...s.versions, [flowId]: (s.versions[flowId] ?? []).filter(v => v.id !== versionId) } }))
  },

  openEdit: (flow) => set({ editingFlow: flow }),
  closeEdit: () => set({ editingFlow: undefined }),
}))
