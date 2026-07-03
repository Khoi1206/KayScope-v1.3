import { eq, and, desc, inArray } from 'drizzle-orm'
import { db, flowVersions } from '../index'
import type { FlowNode, FlowEdge } from '../schema'

// Versions are manual snapshots, not autosaves, but a flow that gets a lot of
// "Save Version" clicks over its lifetime shouldn't grow the table unbounded —
// keep the most recent N and silently drop older ones on each new save.
const MAX_VERSIONS_PER_FLOW = 20

export async function createFlowVersion(data: {
  workspaceId: string
  flowId: string
  label?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdBy: string
}) {
  const rows = await db.insert(flowVersions).values(data).returning()
  await pruneFlowVersions(data.flowId)
  return rows[0]!
}

async function pruneFlowVersions(flowId: string) {
  const all = await db
    .select({ id: flowVersions.id })
    .from(flowVersions)
    .where(eq(flowVersions.flowId, flowId))
    .orderBy(desc(flowVersions.createdAt))
  const toDelete = all.slice(MAX_VERSIONS_PER_FLOW).map(r => r.id)
  if (toDelete.length > 0) {
    await db.delete(flowVersions).where(inArray(flowVersions.id, toDelete))
  }
}

export async function deleteFlowVersion(id: string) {
  await db.delete(flowVersions).where(eq(flowVersions.id, id))
}

export async function findFlowVersionsByFlow(flowId: string, limit = 20) {
  return db
    .select()
    .from(flowVersions)
    .where(eq(flowVersions.flowId, flowId))
    .orderBy(desc(flowVersions.createdAt))
    .limit(limit)
}

export async function findFlowVersionByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(flowVersions)
    .where(and(eq(flowVersions.id, id), eq(flowVersions.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}
