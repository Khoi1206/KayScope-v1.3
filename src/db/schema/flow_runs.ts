import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { flows } from './flows'
import { createId } from '../utils'

// ── Result types stored in JSONB ──────────────────────────────────────────────

export interface PlaywrightTestResult {
  testName: string
  status: 'passed' | 'failed' | 'skipped' | 'timedOut'
  duration: number
  error?: string
}

export interface PlaywrightRunResult {
  success: boolean
  summary: { total: number; passed: number; failed: number; skipped: number; duration: number }
  tests: PlaywrightTestResult[]
  rawOutput: string
}

export interface FlowRunSummary {
  total: number
  passed: number
  failed: number
  duration: number
}

// ── Table ─────────────────────────────────────────────────────────────────────

export const flowRuns = pgTable('flow_runs', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  flowId: text('flow_id').notNull().references(() => flows.id, { onDelete: 'cascade' }),
  // Snapshot — survives flow renames
  flowName: text('flow_name').notNull(),
  status: text('status').$type<'running' | 'passed' | 'failed' | 'errored'>().notNull().default('running'),
  // Full Playwright JSON reporter output — excluded from list queries
  testResults: jsonb('test_results').$type<PlaywrightRunResult>(),
  // Summary — included in all list views
  summary: jsonb('summary').$type<FlowRunSummary>().notNull().default({ total: 0, passed: 0, failed: 0, duration: 0 }),
  triggeredBy: text('triggered_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export type FlowRun = typeof flowRuns.$inferSelect
export type NewFlowRun = typeof flowRuns.$inferInsert
