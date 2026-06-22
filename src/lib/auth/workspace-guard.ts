import type { NextRequest } from 'next/server'
import {
  findWorkspaceByIdAndOwner,
  findWorkspaceByOwner,
} from '@/db/queries/workspaces'
import { ForbiddenError, NotFoundError } from '@/lib/errors'

/**
 * Resolve the active workspace for the current request.
 *
 * Priority:
 *  1. `X-Workspace-Id` header — validated against the authenticated user (IDOR guard)
 *  2. Fallback: first workspace owned by the user (backward-compat when no header is sent)
 *
 * Throws ForbiddenError if the header carries an ID the user doesn't own.
 * Throws NotFoundError if the user has no workspaces at all.
 */
export async function requireActiveWorkspace(req: NextRequest, userId: string) {
  const id = req.headers.get('X-Workspace-Id')
  if (id) {
    const ws = await findWorkspaceByIdAndOwner(id, userId)
    if (!ws) throw new ForbiddenError('Workspace not found or access denied')
    return ws
  }
  // No header — fall back to the first workspace (handles legacy / unauthenticated callers)
  const ws = await findWorkspaceByOwner(userId)
  if (!ws) throw new NotFoundError('Workspace not found')
  return ws
}
