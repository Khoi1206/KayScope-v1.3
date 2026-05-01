import { eq, and, desc } from 'drizzle-orm'
import { db, flowRuns } from '../index'
import type { PlaywrightRunResult, FlowRunSummary } from '../schema'

export async function createFlowRun(data: {
  workspaceId: string
  flowId: string
  flowName: string
  triggeredBy: string
}) {
  const rows = await db
    .insert(flowRuns)
    .values({
      ...data,
      status: 'running',
      summary: { total: 0, passed: 0, failed: 0, duration: 0 },
    })
    .returning()
  return rows[0]!
}

export async function finalizeFlowRun(
  id: string,
  data: {
    testResults: PlaywrightRunResult | null
    summary: FlowRunSummary
    status: 'passed' | 'failed' | 'errored'
  }
) {
  const rows = await db
    .update(flowRuns)
    .set({ ...data, finishedAt: new Date() })
    .where(eq(flowRuns.id, id))
    .returning()
  return rows[0] ?? null
}

// List view: explicitly excludes heavy `testResults` column
export async function findFlowRunsByFlow(flowId: string, limit = 10) {
  return db
    .select({
      id: flowRuns.id,
      workspaceId: flowRuns.workspaceId,
      flowId: flowRuns.flowId,
      flowName: flowRuns.flowName,
      status: flowRuns.status,
      summary: flowRuns.summary,
      triggeredBy: flowRuns.triggeredBy,
      createdAt: flowRuns.createdAt,
      finishedAt: flowRuns.finishedAt,
    })
    .from(flowRuns)
    .where(eq(flowRuns.flowId, flowId))
    .orderBy(desc(flowRuns.createdAt))
    .limit(limit)
}

export async function findFlowRunById(id: string) {
  const rows = await db.select().from(flowRuns).where(eq(flowRuns.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findFlowRunByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(flowRuns)
    .where(and(eq(flowRuns.id, id), eq(flowRuns.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}
