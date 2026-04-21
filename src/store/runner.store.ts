'use client'

import { create } from 'zustand'
import type { RunnerResult } from '@/lib/execute/runner'
import type { DataRow } from '@/lib/data-parser'

export interface RunnerState {
  /** Collection being run (id + name) */
  collectionId: string | null
  collectionName: string | null
  running: boolean
  result: RunnerResult | null
  error: string | null

  startRun: (
    collectionId: string,
    collectionName: string,
    environmentId: string | undefined,
    dataRows: DataRow[]
  ) => Promise<void>
  reset: () => void
}

export const useRunnerStore = create<RunnerState>((set) => ({
  collectionId: null,
  collectionName: null,
  running: false,
  result: null,
  error: null,

  startRun: async (collectionId, collectionName, environmentId, dataRows) => {
    set({ running: true, result: null, error: null, collectionId, collectionName })
    try {
      const res = await fetch('/api/runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, environmentId, dataRows }),
      })
      const data = await res.json()
      if (!res.ok) {
        set({ error: data.error ?? 'Runner failed', running: false })
      } else {
        set({ result: data as RunnerResult, running: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Network error', running: false })
    }
  },

  reset: () => set({ collectionId: null, collectionName: null, running: false, result: null, error: null }),
}))
