'use client'

import { create } from 'zustand'
import type { RunnerResult, RunnerSummary } from '@/lib/execute/runner'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestSuiteItem {
  id: string
  workspaceId: string
  collectionId: string
  name: string
  description?: string | null
  environmentId?: string | null
  dataRows: Record<string, string>[]
  sortOrder: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

// List-view run (no heavy `iterations` column)
export interface TestRunSummaryItem {
  id: string
  workspaceId: string
  testSuiteId: string
  collectionId: string
  collectionName: string
  environmentId?: string | null
  status: 'running' | 'passed' | 'failed' | 'errored'
  summary: RunnerSummary
  triggeredBy: string
  createdAt: string
  finishedAt?: string | null
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface TestSuiteStore {
  suites: TestSuiteItem[]
  loading: boolean
  error: string | null

  // Currently running
  runningId: string | null
  runResult: RunnerResult | null
  runRecord: TestRunSummaryItem | null
  runError: string | null

  // Per-suite run history cache
  recentRuns: Record<string, TestRunSummaryItem[]>

  // Modal state: undefined = closed, null = create new, item = edit
  editingSuite: TestSuiteItem | null | undefined

  // Historical run detail modal
  showResultsRunId: string | null
  showResultsData: RunnerResult | null
  showResultsRecord: TestRunSummaryItem | null

  // Actions
  fetchSuites: () => Promise<void>
  fetchRecentRuns: (suiteId: string) => Promise<void>
  createSuite: (data: {
    collectionId: string
    name: string
    description?: string
    environmentId?: string
    dataRows: Record<string, string>[]
  }) => Promise<TestSuiteItem>
  updateSuite: (id: string, data: {
    name?: string
    description?: string | null
    environmentId?: string | null
    dataRows?: Record<string, string>[]
  }) => Promise<void>
  deleteSuite: (id: string) => Promise<void>
  runSuite: (suiteId: string) => Promise<void>
  resetRun: () => void
  openEdit: (suite: TestSuiteItem | null) => void
  closeEdit: () => void
  openResults: (runId: string, result: RunnerResult, record: TestRunSummaryItem) => void
  closeResults: () => void
}

export const useTestSuiteStore = create<TestSuiteStore>((set, get) => ({
  suites: [],
  loading: false,
  error: null,
  runningId: null,
  runResult: null,
  runRecord: null,
  runError: null,
  recentRuns: {},
  editingSuite: undefined,
  showResultsRunId: null,
  showResultsData: null,
  showResultsRecord: null,

  fetchSuites: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/test-suites')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load test suites')
      set({ suites: data as TestSuiteItem[], loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Error', loading: false })
    }
  },

  fetchRecentRuns: async (suiteId: string) => {
    try {
      const res = await fetch(`/api/test-suites/${suiteId}/runs?limit=10`)
      const data = await res.json()
      if (!res.ok) return
      set(s => ({ recentRuns: { ...s.recentRuns, [suiteId]: data as TestRunSummaryItem[] } }))
    } catch {
      // Non-critical; silently ignore
    }
  },

  createSuite: async (data) => {
    const res = await fetch('/api/test-suites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to create test suite')
    const suite = json as TestSuiteItem
    set(s => ({ suites: [...s.suites, suite] }))
    return suite
  },

  updateSuite: async (id, data) => {
    const res = await fetch(`/api/test-suites/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to update test suite')
    const updated = json as TestSuiteItem
    set(s => ({ suites: s.suites.map(s => s.id === id ? updated : s) }))
  },

  deleteSuite: async (id) => {
    const res = await fetch(`/api/test-suites/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Failed to delete test suite')
    }
    set(s => ({
      suites: s.suites.filter(s => s.id !== id),
      recentRuns: Object.fromEntries(Object.entries(s.recentRuns).filter(([k]) => k !== id)),
    }))
  },

  runSuite: async (suiteId: string) => {
    set({ runningId: suiteId, runResult: null, runRecord: null, runError: null })
    try {
      const res = await fetch(`/api/test-suites/${suiteId}/run`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        set({ runError: data.error ?? 'Run failed', runningId: null })
        return
      }
      const { run, result } = data as { run: TestRunSummaryItem; result: RunnerResult }
      // Prepend to recent runs cache
      set(s => ({
        runningId: null,
        runResult: result,
        runRecord: run,
        recentRuns: {
          ...s.recentRuns,
          [suiteId]: [run, ...(s.recentRuns[suiteId] ?? [])].slice(0, 10),
        },
      }))
    } catch (err) {
      set({ runError: err instanceof Error ? err.message : 'Network error', runningId: null })
    }
  },

  resetRun: () => set({ runningId: null, runResult: null, runRecord: null, runError: null }),

  openEdit: (suite) => set({ editingSuite: suite }),
  closeEdit: () => set({ editingSuite: undefined }),

  openResults: (runId, result, record) => set({
    showResultsRunId: runId,
    showResultsData: result,
    showResultsRecord: record,
  }),
  closeResults: () => set({
    showResultsRunId: null,
    showResultsData: null,
    showResultsRecord: null,
  }),
}))
