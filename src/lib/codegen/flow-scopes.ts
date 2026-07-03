import type { Flow } from '@/db/schema/flows'
import { emptyScopes, mergeScopes, type ScopeSet } from '@/core/interpolation/scope'
import { createDynamicVarSnapshot, type DynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'
import { findWorkspaceById } from '@/db/queries/workspaces'
import { findEnvironmentByIdForWorkspace } from '@/db/queries/environments'
import { decryptVariables } from '@/lib/execute/variable-crypto'

/**
 * Loads the environment + workspace global variable scope for a flow, decrypting
 * secrets server-side (same helper `executor.ts` uses for request execution).
 * Used by the run/ui routes to resolve {{variable}} tokens before codegen —
 * never by the export route, which must not leak decrypted secrets into a
 * file the client downloads and keeps.
 */
export async function loadFlowScopes(
  flow: Pick<Flow, 'workspaceId' | 'environmentId'>
): Promise<{ scopes: ScopeSet; dynamicVars: DynamicVarSnapshot }> {
  const [workspace, environment] = await Promise.all([
    findWorkspaceById(flow.workspaceId),
    flow.environmentId ? findEnvironmentByIdForWorkspace(flow.environmentId, flow.workspaceId) : null,
  ])

  const scopes = mergeScopes(emptyScopes(), {
    environment: decryptVariables(environment?.variables ?? []),
    global: decryptVariables(workspace?.globalVariables ?? []),
  })

  return { scopes, dynamicVars: createDynamicVarSnapshot() }
}
