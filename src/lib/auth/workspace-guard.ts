import type { NextRequest } from 'next/server'
import { findWorkspaceByOwner, findWorkspaceById } from '@/db/queries/workspaces'
import { findMembership } from '@/db/queries/workspace_members'
import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { type EffectiveRole, roleAtLeast } from './workspace-roles'

export { type EffectiveRole, roleAtLeast } from './workspace-roles'

/**
 * Resolves a user's effective role in a workspace: 'owner' if they own it
 * (always full access, never represented as a workspace_members row), else
 * their membership role if one exists, else null (no access at all).
 */
export async function getEffectiveRole(workspaceId: string, userId: string): Promise<EffectiveRole | null> {
  const ws = await findWorkspaceById(workspaceId)
  if (ws?.ownerId === userId) return 'owner'
  const member = await findMembership(workspaceId, userId)
  return member?.role ?? null
}

/**
 * Resolve the active workspace for the current request.
 *
 * Priority:
 *  1. `X-Workspace-Id` header — validated against the authenticated user (IDOR guard).
 *     Grants access if the user owns the workspace OR has any membership role
 *     (viewer included) — this is a read-access check; use requireWorkspaceRole
 *     for routes that mutate data.
 *  2. Fallback: first workspace owned by the user (backward-compat when no header is sent)
 *
 * Throws ForbiddenError if the header carries an ID the user has no access to.
 * Throws NotFoundError if the user has no workspaces at all.
 */
export async function requireActiveWorkspace(req: NextRequest, userId: string) {
  const id = req.headers.get('X-Workspace-Id')
  if (id) {
    const ws = await findWorkspaceById(id)
    if (!ws) throw new NotFoundError('Workspace')
    const role = await getEffectiveRole(id, userId)
    if (!role) throw new ForbiddenError('Workspace not found or access denied')
    return ws
  }
  // No header — fall back to the first workspace (handles legacy / unauthenticated callers)
  const ws = await findWorkspaceByOwner(userId)
  if (!ws) throw new NotFoundError('Workspace')
  return ws
}

/**
 * Like requireActiveWorkspace, but also requires the caller's effective role to
 * be at least `min` — use this at every mutating (POST/PUT/PATCH/DELETE) route
 * call site instead of requireActiveWorkspace, so viewer-role members can read
 * but not write.
 */
export async function requireWorkspaceRole(req: NextRequest, userId: string, min: 'editor' | 'admin') {
  const workspace = await requireActiveWorkspace(req, userId)
  const role = await getEffectiveRole(workspace.id, userId)
  if (!role || !roleAtLeast(role, min)) throw new ForbiddenError('Insufficient workspace role')
  return workspace
}
