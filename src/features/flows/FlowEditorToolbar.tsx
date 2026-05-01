'use client'

import { ArrowLeft, Play, Download, Loader2, Clapperboard } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useFlowStore } from '@/store/flow.store'

interface Props {
  flowId: string
  flowName: string
  runError?: string | null
}

export default function FlowEditorToolbar({ flowId, flowName, runError }: Props) {
  const { setActiveFlow, runFlow, runningId, openUi, openingUiId } = useFlowStore()
  const isRunning = runningId === flowId
  const isOpeningUi = openingUiId === flowId

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-th-border bg-th-surface px-3 py-2">
      {/* Back button */}
      <button
        onClick={() => setActiveFlow(null)}
        title="Back to editor"
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <ArrowLeft size={13} />
        Back
      </button>

      <div className="h-4 w-px bg-th-border mx-1" />

      {/* Flow name */}
      <span className="flex-1 text-sm font-semibold text-th-fg truncate">{flowName}</span>

      {runError && (
        <span className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 max-w-xs truncate">
          {runError}
        </span>
      )}

      {/* Export */}
      <button
        onClick={() => window.open(`/api/flows/${flowId}/export`, '_blank')}
        title="Export as .spec.ts"
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <Download size={13} />
        Export
      </button>

      {/* Test UI */}
      <button
        onClick={() => void openUi(flowId)}
        disabled={isOpeningUi}
        title="Open Playwright UI mode"
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1.5 text-xs',
          isOpeningUi
            ? 'cursor-not-allowed text-purple-400/50'
            : 'text-purple-400 hover:bg-purple-500/10 hover:text-purple-300'
        )}
      >
        {isOpeningUi ? <Loader2 size={13} className="animate-spin" /> : <Clapperboard size={13} />}
        {isOpeningUi ? 'Opening…' : 'Test UI'}
      </button>

      {/* Run */}
      <button
        onClick={() => void runFlow(flowId)}
        disabled={isRunning}
        className={cn(
          'flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold',
          isRunning
            ? 'bg-th-accent/50 text-white cursor-not-allowed'
            : 'bg-th-accent text-white hover:bg-th-accent-hover'
        )}
      >
        {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {isRunning ? 'Running…' : 'Run Flow'}
      </button>
    </div>
  )
}
