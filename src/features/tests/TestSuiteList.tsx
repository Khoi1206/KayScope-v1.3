'use client'

import { useEffect, useState } from 'react'
import { Plus, Play, MoreHorizontal, Pencil, Trash2, BarChart2, Download, Loader2 } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { ListRowSkeleton } from '@/components/ui/Skeleton'
import { useTestSuiteStore, type TestSuiteItem } from '@/store/test-suite.store'
import { useCollectionStore } from '@/store/collection.store'
import { downloadFile } from '@/lib/download'
import TestSuiteModal from './TestSuiteModal'
import TestRunResultsModal from './TestRunResultsModal'
import TestReportPanel from './TestReportPanel'
import ConfirmModal from '@/components/ConfirmModal'

export default function TestsSection() {
  const {
    suites, loading, error,
    runningId, runResult, runRecord, runError,
    editingSuite, showResultsRunId, showResultsData, showResultsRecord,
    fetchSuites, runSuite, deleteSuite, resetRun,
    openEdit, closeEdit, closeResults,
  } = useTestSuiteStore()
  const { collections } = useCollectionStore()

  const [reportSuite, setReportSuite] = useState<TestSuiteItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TestSuiteItem | null>(null)

  useEffect(() => {
    fetchSuites()
  }, [fetchSuites])

  // Auto-open results modal when a run completes
  useEffect(() => {
    if (runResult && runRecord) {
      // Modal controlled by runResult being non-null; user closes via resetRun
    }
  }, [runResult, runRecord])

  async function handleRun(suite: TestSuiteItem) {
    await runSuite(suite.id)
  }

  async function confirmDeleteSuite() {
    if (!deleteTarget) return
    await deleteSuite(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-th-fg-muted">
          Tests
        </span>
        <button
          onClick={() => openEdit(null)}
          title="New Test Suite"
          className="rounded-md p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {loading && suites.length === 0 && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <ListRowSkeleton key={i} />
            ))}
          </>
        )}
        {error && <p className="px-3 py-2 text-xs text-red-400">{error}</p>}
        {runError && <p className="px-3 py-1 text-xs text-red-400">{runError}</p>}

        {!loading && suites.length === 0 && (
          <p className="px-3 py-4 text-xs text-th-fg-subtle">
            No test suites yet.{' '}
            <button onClick={() => openEdit(null)} className="text-th-accent hover:underline">
              Create one
            </button>{' '}
            to save a collection run configuration.
          </p>
        )}

        {suites.map(suite => (
          <SuiteRow
            key={suite.id}
            suite={suite}
            collectionName={collections.find(c => c.id === suite.collectionId)?.name ?? ''}
            isRunning={runningId === suite.id}
            onRun={() => handleRun(suite)}
            onEdit={() => openEdit(suite)}
            onDelete={() => setDeleteTarget(suite)}
            onViewRuns={() => setReportSuite(suite)}
          />
        ))}
      </div>

      {/* Create/edit modal */}
      {editingSuite !== undefined && (
        <TestSuiteModal suite={editingSuite} onClose={closeEdit} />
      )}

      {/* Live run results modal */}
      {runResult && runRecord && (
        <TestRunResultsModal
          suiteName={suites.find(s => s.id === runRecord.testSuiteId)?.name ?? ''}
          result={runResult}
          record={runRecord}
          onClose={resetRun}
        />
      )}

      {/* Historical run detail modal */}
      {showResultsRunId && showResultsData && showResultsRecord && (
        <TestRunResultsModal
          suiteName={suites.find(s => s.id === showResultsRecord.testSuiteId)?.name ?? ''}
          result={showResultsData}
          record={showResultsRecord}
          onClose={closeResults}
        />
      )}

      {/* Reporting panel */}
      {reportSuite && (
        <TestReportPanel suite={reportSuite} onClose={() => setReportSuite(null)} />
      )}

      {deleteTarget && (
        <ConfirmModal
          message={`Delete test suite "${deleteTarget.name}"? All run history will also be deleted.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteSuite}
        />
      )}
    </div>
  )
}

// ── Suite row ─────────────────────────────────────────────────────────────────

interface RowProps {
  suite: TestSuiteItem
  collectionName: string
  isRunning: boolean
  onRun: () => void
  onEdit: () => void
  onDelete: () => void
  onViewRuns: () => void
}

function SuiteRow({ suite, collectionName, isRunning, onRun, onEdit, onDelete, onViewRuns }: RowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative mx-1 flex items-center rounded-md px-2 py-2 transition-colors hover:bg-th-surface-hover">
      {/* Play button */}
      <button
        onClick={onRun}
        disabled={isRunning}
        title="Run suite"
        className={cn(
          'mr-1.5 shrink-0 rounded p-0.5 text-th-fg-muted transition-colors hover:text-th-accent',
          isRunning && 'animate-pulse text-th-accent'
        )}
      >
        {isRunning
          ? <Loader2 size={13} className="animate-spin" />
          : <Play size={13} />
        }
      </button>

      {/* Suite info */}
      <button
        onClick={onEdit}
        className="flex flex-1 flex-col items-start overflow-hidden text-left"
      >
        <span className="w-full truncate text-xs font-medium text-th-fg">{suite.name}</span>
        {collectionName && (
          <span className="w-full truncate text-[11px] text-th-fg-subtle">{collectionName}</span>
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
                onClick={() => { setMenuOpen(false); onViewRuns() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
              >
                <BarChart2 size={11} /> View Runs
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  downloadFile(`/api/test-suites/${suite.id}/export`, `${suite.name}.test.ts`)
                    .catch(err => console.error('Export failed', err))
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
              >
                <Download size={11} /> Export as Playwright
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
