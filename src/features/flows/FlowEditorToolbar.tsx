'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Play, Download, Loader2, Clapperboard, Settings, Square, History, Maximize2 } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useFlowStore } from '@/store/flow.store'
import { downloadFile } from '@/lib/download'
import type { FlowBrowser } from '@/db/schema'
import FlowSettingsModal from './FlowSettingsModal'
import FlowUiModal from './FlowUiModal'

interface Props {
  flowId: string
  flowName: string
  browsers: FlowBrowser[]
  environmentId?: string | null
  timeoutMs: number
  runError?: string | null
  onOpenVersions: () => void
}

export default function FlowEditorToolbar({ flowId, flowName, browsers, environmentId, timeoutMs, runError, onOpenVersions }: Props) {
  const t = useTranslations('flows')
  const { setActiveFlow, runFlow, runningId, openUi, stopUi, checkUiStatus, openingUiId, runningUiIds, uiError } = useFlowStore()
  const [showSettings, setShowSettings] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [showUiPanel, setShowUiPanel] = useState(false)
  const isRunning = runningId === flowId
  const isOpeningUi = openingUiId === flowId
  const isUiRunning = runningUiIds.includes(flowId)

  // Sync with server-side session state on mount / flow switch — the in-memory
  // UI-process registry survives page reloads, our local store doesn't.
  useEffect(() => { void checkUiStatus(flowId) }, [flowId, checkUiStatus])

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-th-border bg-th-surface px-3 py-2">
      {/* Back button */}
      <button
        onClick={() => setActiveFlow(null)}
        title={t('toolbar.backHint')}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <ArrowLeft size={13} />
        {t('backToEditor')}
      </button>

      <div className="h-4 w-px bg-th-border mx-1" />

      {/* Flow name */}
      <span className="flex-1 text-sm font-semibold text-th-fg truncate">{flowName}</span>

      {runError && (
        <span className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 max-w-xs truncate">
          {runError}
        </span>
      )}

      {uiError && (
        <span
          className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-400 max-w-xs truncate"
          title={uiError}
        >
          {uiError}
        </span>
      )}

      {/* Versions */}
      <button
        onClick={onOpenVersions}
        title={t('toolbar.versionsHint')}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <History size={13} />
      </button>

      {/* Settings */}
      <button
        onClick={() => setShowSettings(true)}
        title={t('toolbar.settingsHint')}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <Settings size={13} />
      </button>

      {/* Export */}
      <button
        onClick={() => {
          downloadFile(`/api/flows/${flowId}/export`, `${flowName}.spec.ts`)
            .catch(err => console.error('Export failed', err))
        }}
        title={t('toolbar.exportHint')}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
      >
        <Download size={13} />
        {t('toolbar.export')}
      </button>

      {/* Test UI */}
      {isUiRunning ? (
        <>
          <button
            onClick={() => setShowUiPanel(true)}
            title={t('toolbar.showUiHint')}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={async () => {
              setStopping(true)
              try { await stopUi(flowId) } finally { setStopping(false) }
            }}
            disabled={stopping}
            title={t('toolbar.stopUiHint')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1.5 text-xs',
              stopping ? 'cursor-not-allowed text-red-400/50' : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
            )}
          >
            {stopping ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
            {stopping ? t('toolbar.stoppingUi') : t('toolbar.stopUi')}
          </button>
        </>
      ) : (
        <button
          onClick={async () => {
            await openUi(flowId)
            if (useFlowStore.getState().runningUiIds.includes(flowId)) setShowUiPanel(true)
          }}
          disabled={isOpeningUi}
          title={t('toolbar.testUiHint')}
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1.5 text-xs',
            isOpeningUi
              ? 'cursor-not-allowed text-purple-400/50'
              : 'text-purple-400 hover:bg-purple-500/10 hover:text-purple-300'
          )}
        >
          {isOpeningUi ? <Loader2 size={13} className="animate-spin" /> : <Clapperboard size={13} />}
          {isOpeningUi ? t('toolbar.openingUi') : t('toolbar.testUi')}
        </button>
      )}

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
        {isRunning ? t('running') : t('run')}
      </button>

      {showSettings && (
        <FlowSettingsModal
          flowId={flowId}
          currentBrowsers={browsers}
          currentEnvironmentId={environmentId}
          currentTimeoutMs={timeoutMs}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showUiPanel && isUiRunning && (
        <FlowUiModal flowId={flowId} onClose={() => setShowUiPanel(false)} />
      )}
    </div>
  )
}
