import { eq, and } from 'drizzle-orm'
import { db, workspaces } from '../index'
import type { Variable } from '../schema'
import type { WorkspaceType } from '../schema'

// ── Read ──────────────────────────────────────────────────────────────────────

/** Find the first workspace owned by this user (backward-compat fallback). */
export async function findWorkspaceByOwner(ownerId: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
    .limit(1)
  return rows[0] ?? null
}

/** Find a specific workspace by id (no ownership check — use findWorkspaceByIdAndOwner for guarded access). */
export async function findWorkspaceById(id: string) {
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
  return rows[0] ?? null
}

/** Find a workspace by id AND verify ownership — IDOR-safe lookup. */
export async function findWorkspaceByIdAndOwner(id: string, ownerId: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.ownerId, ownerId)))
    .limit(1)
  return rows[0] ?? null
}

/** Return all workspaces owned by this user (id, name, type, description, createdAt only). */
export async function findAllWorkspacesByOwner(ownerId: string) {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      type: workspaces.type,
      description: workspaces.description,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
    .orderBy(workspaces.createdAt)
}

/** Count how many workspaces this user owns — used for delete guard. */
export async function countWorkspacesByOwner(ownerId: string): Promise<number> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
  return rows.length
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createWorkspace(
  ownerId: string,
  name: string,
  options?: { type?: WorkspaceType; description?: string }
) {
  const rows = await db
    .insert(workspaces)
    .values({
      ownerId,
      name,
      type: options?.type ?? 'personal',
      description: options?.description ?? null,
      globalVariables: [],
    })
    .returning()
  return rows[0]!
}

/** Get or create the user's personal workspace. */
export async function upsertPersonalWorkspace(ownerId: string, name: string) {
  const existing = await findWorkspaceByOwner(ownerId)
  if (existing) return existing
  return createWorkspace(ownerId, name, { type: 'personal' })
}

export async function updateWorkspace(
  id: string,
  data: Partial<{
    name: string
    type: WorkspaceType
    description: string | null
    globalVariables: Variable[]
    activeEnvironmentId: string | null
  }>
) {
  const rows = await db
    .update(workspaces)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning()
  return rows[0] ?? null
}

/** Delete a workspace (caller must verify ownership and that it's not the last one). */
export async function deleteWorkspace(id: string, ownerId: string) {
  await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, id), eq(workspaces.ownerId, ownerId)))
}
