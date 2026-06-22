'use client'

import { create } from 'zustand'
import type { Example } from '@/db/schema/examples'
import type { KVPair, RequestBody, RequestAuth } from './request.store'
import { getWorkspaceHeaders } from './workspace.store'

export type { Example }

interface ExampleStore {
  // examples keyed by requestId
  examples: Record<string, Example[]>
  loading: Record<string, boolean>

  fetchExamples: (requestId: string) => Promise<void>
  createExample: (requestId: string, data: {
    name: string
    status?: number
    statusText?: string
    responseHeaders?: Record<string, string>
    responseBody?: string
    durationMs?: number
    size?: number
    requestMethod?: string
    requestUrl?: string
    requestParams?: KVPair[]
    requestHeaders?: KVPair[]
    requestBody?: RequestBody
    requestAuth?: RequestAuth
  }) => Promise<Example>
  renameExample: (id: string, requestId: string, name: string) => Promise<void>
  deleteExample: (id: string, requestId: string) => Promise<void>
}

export const useExampleStore = create<ExampleStore>((set, get) => ({
  examples: {},
  loading: {},

  fetchExamples: async (requestId) => {
    if (get().loading[requestId]) return
    set(s => ({ loading: { ...s.loading, [requestId]: true } }))
    try {
      const res = await fetch(`/api/requests/${requestId}/examples`, { headers: getWorkspaceHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load examples')
      set(s => ({
        examples: { ...s.examples, [requestId]: data as Example[] },
        loading: { ...s.loading, [requestId]: false },
      }))
    } catch {
      set(s => ({ loading: { ...s.loading, [requestId]: false } }))
    }
  },

  createExample: async (requestId, data) => {
    const res = await fetch(`/api/requests/${requestId}/examples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to save example')
    const example = json as Example
    set(s => ({
      examples: {
        ...s.examples,
        [requestId]: [example, ...(s.examples[requestId] ?? [])],
      },
    }))
    return example
  },

  renameExample: async (id, requestId, name) => {
    const res = await fetch(`/api/examples/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Failed to rename example')
    const updated = json as Example
    set(s => ({
      examples: {
        ...s.examples,
        [requestId]: (s.examples[requestId] ?? []).map(e => e.id === id ? updated : e),
      },
    }))
  },

  deleteExample: async (id, requestId) => {
    const res = await fetch(`/api/examples/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      throw new Error(json.error ?? 'Failed to delete example')
    }
    set(s => ({
      examples: {
        ...s.examples,
        [requestId]: (s.examples[requestId] ?? []).filter(e => e.id !== id),
      },
    }))
  },
}))
