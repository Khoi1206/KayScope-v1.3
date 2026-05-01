'use client'

import { useEffect, useState } from 'react'
import { Plus, Play, MoreHorizontal, Pencil, Trash2, BarChart2, Download, Loader2 } from 'lucide-react'
import { useFlowStore, type FlowItem } from '@/store/flow.store'
import FlowModal from './FlowModal'
import FlowRunHistoryPanel from './FlowRunHistoryPanel'

export default function FlowsSection() {
  const { flows, loading, error, runningId, editingFlow, fetchFlows, setActiveFlow, deleteFlow, runFlow, openEdit, closeEdit } = useFlowStore()
  const [historyFlow, setHistoryFlow] = useState<FlowItem | null>(null)

  useEffect(() => { fetchFlows() }, [fetchFlows])

  async function handleDelete(flow: FlowItem) {
    if (!confirm(`Delete flow "${flow.name}"? All run history will also be deleted.`)) return
    await deleteFlow(flow.id)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">Flows</span>
        <button
          onClick={() => openEdit(null)}
          title="New Flow"
          className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-th-fg-muted">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}

        {!loading && flows.length === 0 && (
          <p className="px-3 py-4 text-xs text-th-fg-subtle">
            No flows yet.{' '}
            <button onClick={() => openEdit(null)} className="text-th-accent hover:underline">Create one</button>{' '}
            to build a browser automation.
          </p>
        )}

        {flows.map(flow => (
          <FlowRow
            key={flow.id}
            flow={flow}
            isRunning={runningId === flow.id}
            onOpen={() => setActiveFlow(flow.id)}
            onRun={() => void runFlow(flow.id)}
            onEdit={() => openEdit(flow)}
            onDelete={() => handleDelete(flow)}
            onViewRuns={() => setHistoryFlow(flow)}
          />
        ))}
      </div>

      {editingFlow !== undefined && (
        <FlowModal flow={editingFlow} onClose={closeEdit} />
      )}

      {historyFlow && (
        <FlowRunHistoryPanel flow={historyFlow} onClose={() => setHistoryFlow(null)} />
      )}
    </div>
  )
}

interface RowProps {
  flow: FlowItem
  isRunning: boolean
  onOpen: () => void
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  onViewRuns: () => void
}

function FlowRow({ flow, isRunning, onOpen, onRun, onEdit, onDelete, onViewRuns }: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative mx-1 flex items-center rounded-md px-2 py-2 transition-colors hover:bg-th-surface-hover">
      {/* Play button */}
      <button
        onClick={e => { e.stopPropagation(); onRun() }}
        disabled={isRunning}
        title="Run flow"
        className="mr-1.5 shrink-0 rounded p-0.5 text-th-fg-muted hover:text-th-accent disabled:opacity-50"
      >
        {isRunning ? <Loader2 size={13} className="animate-spin text-th-accent" /> : <Play size={13} />}
      </button>

      {/* Flow name */}
      <button onClick={onOpen} className="flex-1 overflow-hidden text-left">
        <span className="block w-full truncate text-xs font-medium text-th-fg">{flow.name}</span>
        {flow.description && (
          <span className="block w-full truncate text-[11px] text-th-fg-subtle">{flow.description}</span>
        )}
      </button>

      {/* Context menu */}
      <div className="relative shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="rounded p-1 text-th-fg-muted hover:bg-th-surface hover:text-th-fg"
        >
          <MoreHorizontal size={13} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-th-border bg-th-bg py-1 shadow-xl">
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                onClick={() => { setMenuOpen(false); onRun() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
              >
                <Play size={11} /> Run
              </button>
              <button
                onClick={() => { setMenuOpen(false); onViewRuns() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
              >
                <BarChart2 size={11} /> View Runs
              </button>
              <button
                onClick={() => { setMenuOpen(false); window.open(`/api/flows/${flow.id}/export`, '_blank') }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
              >
                <Download size={11} /> Export .spec.ts
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-400 hover:bg-th-surface-hover"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
