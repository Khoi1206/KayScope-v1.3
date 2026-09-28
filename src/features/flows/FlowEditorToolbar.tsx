'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Play, Download, Loader2, Settings, History } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { useFlowStore } from '@/store/flow.store'
import { downloadFile } from '@/lib/download'
import type { FlowBrowser } from '@/db/schema'
import FlowSettingsModal from './FlowSettingsModal'

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
  const { setActiveFlow, runFlow, runningId } = useFlowStore()
  const [showSettings, setShowSettings] = useState(false)
  const isRunning = runningId === flowId

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
    </div>
  )
}
