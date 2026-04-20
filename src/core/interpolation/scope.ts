// ── Scope types ────────────────────────────────────────────────────────────

/**
 * All variable scopes, ordered highest-to-lowest priority:
 * request > local > data > environment > collection > global
 */
export interface ScopeSet {
  /** Per-request overrides (script writes during current request) */
  request: Record<string, string>
  /** Local tab overrides (user edits in the variable panel) */
  local: Record<string, string>
  /** Data scope (collection runner row data) */
  data: Record<string, string>
  /** Active environment variables */
  environment: Record<string, string>
  /** Collection-level variables */
  collection: Record<string, string>
  /** Workspace global variables */
  global: Record<string, string>
}

export function emptyScopes(): ScopeSet {
  return {
    request: {},
    local: {},
    data: {},
    environment: {},
    collection: {},
    global: {},
  }
}

/**
 * Merge two ScopeSets — values in `override` win over `base`.
 * Only defined (non-undefined) values in override are applied.
 */
export function mergeScopes(base: ScopeSet, override: Partial<ScopeSet>): ScopeSet {
  return {
    request: { ...base.request, ...(override.request ?? {}) },
    local: { ...base.local, ...(override.local ?? {}) },
    data: { ...base.data, ...(override.data ?? {}) },
    environment: { ...base.environment, ...(override.environment ?? {}) },
    collection: { ...base.collection, ...(override.collection ?? {}) },
    global: { ...base.global, ...(override.global ?? {}) },
  }
}

/**
 * Flatten ScopeSet into a single record in priority order.
 * Used for display purposes only (resolveVar is the authoritative lookup).
 */
export function flattenScopes(scopes: ScopeSet): Record<string, string> {
  return {
    ...scopes.global,
    ...scopes.collection,
    ...scopes.environment,
    ...scopes.data,
    ...scopes.local,
    ...scopes.request,
  }
}

/**
 * Before sending to the server, merge `request` into `local` so the server
 * only needs two client-provided scopes (local + data). The server loads
 * environment/collection/global itself from the DB.
 */
export function toServerScopes(scopes: ScopeSet): { local: Record<string, string>; data: Record<string, string> } {
  return {
    local: { ...scopes.local, ...scopes.request },
    data: { ...scopes.data },
  }
}
