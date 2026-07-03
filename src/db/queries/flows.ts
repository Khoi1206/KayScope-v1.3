import { eq, and, desc } from 'drizzle-orm'
import { db, flows } from '../index'
import type { FlowNode, FlowEdge, FlowBrowser } from '../schema'

export async function findFlowsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(flows)
    .where(eq(flows.workspaceId, workspaceId))
    .orderBy(desc(flows.updatedAt))
}

export async function findFlowById(id: string) {
  const rows = await db.select().from(flows).where(eq(flows.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findFlowByIdForWorkspace(id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(flows)
    .where(and(eq(flows.id, id), eq(flows.workspaceId, workspaceId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createFlow(
  workspaceId: string,
  data: {
    name: string
    description?: string
    nodes: FlowNode[]
    edges: FlowEdge[]
    createdBy: string
  }
) {
  const rows = await db.insert(flows).values({ workspaceId, ...data }).returning()
  return rows[0]!
}

export async function updateFlow(
  id: string,
  data: Partial<{
    name: string
    description: string | null
    nodes: FlowNode[]
    edges: FlowEdge[]
    browsers: FlowBrowser[]
    environmentId: string | null
    timeoutMs: number
  }>
) {
  const rows = await db
    .update(flows)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(flows.id, id))
    .returning()
  return rows[0] ?? null
}

export async function deleteFlow(id: string) {
  await db.delete(flows).where(eq(flows.id, id))
}
