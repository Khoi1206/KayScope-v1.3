import { eq, and, desc } from 'drizzle-orm'
import { db, testRuns } from '../index'
import type { IterationResult, RunnerSummary } from '@/lib/execute/runner'

export async function createTestRun(data: {
  workspaceId: string
  testSuiteId: string
  collectionId: string
  collectionName: string
  environmentId?: string
  triggeredBy: string
}) {
  const rows = await db
    .insert(testRuns)
    .values({
      ...data,
      status: 'running',
      iterations: [],
      summary: { totalRequests: 0, totalIterations: 0, passed: 0, failed: 0, errored: 0, totalDurationMs: 0 },
    })
    .returning()
  return rows[0]!
}

export async function finalizeTestRun(
  id: string,
  data: {
    iterations: IterationResult[]
    summary: RunnerSummary
    status: 'passed' | 'failed' | 'errored'
  }
) {
  const rows = await db
    .update(testRuns)
    .set({ ...data, finishedAt: new Date() })
    .where(eq(testRuns.id, id))
    .returning()
  return rows[0] ?? null
}

// List view: excludes heavy `iterations` column
export async function findTestRunsByTestSuite(testSuiteId: string, limit = 10) {
  return db
    .select({
      id: testRuns.id,
      workspaceId: testRuns.workspaceId,
      testSuiteId: testRuns.testSuiteId,
      collectionId: testRuns.collectionId,
      collectionName: testRuns.collectionName,
      environmentId: testRuns.environmentId,
      status: testRuns.status,
      summary: testRuns.summary,
      triggeredBy: testRuns.triggeredBy,
      createdAt: testRuns.createdAt,
      finishedAt: testRuns.finishedAt,
    })
    .from(testRuns)
    .where(eq(testRuns.testSuiteId, testSuiteId))
    .orderBy(desc(testRuns.createdAt))
    .limit(limit)
}

export async function findTestRunById(id: string) {
  const rows = await db.select().from(testRuns).where(eq(testRuns.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findTestRunByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(testRuns)
    .where(and(eq(testRuns.id, id), eq(testRuns.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}
