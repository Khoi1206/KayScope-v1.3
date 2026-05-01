import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { testSuites } from './test_suites'
import { createId } from '../utils'

export const testRuns = pgTable('test_runs', {
  id: text('id').primaryKey().$defaultFn(createId),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  testSuiteId: text('test_suite_id').notNull().references(() => testSuites.id, { onDelete: 'cascade' }),
  // Denormalised snapshot — survives collection renames/deletes
  collectionId: text('collection_id').notNull(),
  collectionName: text('collection_name').notNull(),
  environmentId: text('environment_id'),
  status: text('status').$type<'running' | 'passed' | 'failed' | 'errored'>().notNull().default('running'),
  // Full RunnerResult.iterations — stored as-is, loaded only for drill-down views
  iterations: jsonb('iterations').notNull().default([]),
  // RunnerResult.summary — stored as-is, loaded for all list views
  summary: jsonb('summary').notNull().default({}),
  triggeredBy: text('triggered_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export type TestRun = typeof testRuns.$inferSelect
export type NewTestRun = typeof testRuns.$inferInsert
