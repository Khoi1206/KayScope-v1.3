import type { ScopeSet } from './scope'
import type { DynamicVarSnapshot } from './dynamic-vars'

// ── Regex ──────────────────────────────────────────────────────────────────

/**
 * Matches {{varName}} tokens.
 * Allows: letters, digits, underscore, dot, hyphen. First char: letter or underscore.
 * Dynamic vars start with $: {{$guid}}, {{$timestamp}}, etc.
 */
const VAR_REGEX = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g

// ── Core resolution ────────────────────────────────────────────────────────

/**
 * Resolve a single variable name against the scope chain.
 * Priority: dynamic > request > local > data > environment > collection > global
 * Returns undefined if not found in any scope.
 */
export function resolveVar(
  name: string,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): string | undefined {
  if (dynamicVars && name in dynamicVars) return dynamicVars[name]
  if (name in scopes.request) return scopes.request[name]
  if (name in scopes.local) return scopes.local[name]
  if (name in scopes.data) return scopes.data[name]
  if (name in scopes.environment) return scopes.environment[name]
  if (name in scopes.collection) return scopes.collection[name]
  if (name in scopes.global) return scopes.global[name]
  return undefined
}

/**
 * Extract all variable names referenced in a string (without {{ }}).
 */
export function extractVarNames(input: string): string[] {
  const names: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(VAR_REGEX.source, 'g')
  while ((match = re.exec(input)) !== null) {
    names.push(match[1]!)
  }
  return names
}

// ── replaceIn ──────────────────────────────────────────────────────────────

/**
 * Low-level replacement. Replaces all {{name}} tokens where the name maps
 * to a value in the provided flat record. Unresolved tokens are left as-is.
 */
export function replaceIn(input: string, vars: Record<string, string>): string {
  return input.replace(new RegExp(VAR_REGEX.source, 'g'), (_match, name: string) => {
    return name in vars ? vars[name]! : `{{${name}}}`
  })
}

// ── interpolate ────────────────────────────────────────────────────────────

/**
 * Interpolate all {{var}} tokens in `input` using the scope chain.
 * Unresolved tokens are left as {{varName}}.
 */
export function interpolate(
  input: string,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): string {
  return input.replace(new RegExp(VAR_REGEX.source, 'g'), (_match, name: string) => {
    const value = resolveVar(name, scopes, dynamicVars)
    return value !== undefined ? value : `{{${name}}}`
  })
}

// ── interpolateWithStatus ──────────────────────────────────────────────────

export interface InterpolateStatus {
  result: string
  hasUnresolved: boolean
  unresolvedVars: string[]
}

/**
 * Like interpolate() but also reports which tokens could not be resolved.
 */
export function interpolateWithStatus(
  input: string,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): InterpolateStatus {
  const unresolvedVars: string[] = []
  const result = input.replace(new RegExp(VAR_REGEX.source, 'g'), (_match, name: string) => {
    const value = resolveVar(name, scopes, dynamicVars)
    if (value !== undefined) return value
    unresolvedVars.push(name)
    return `{{${name}}}`
  })
  return { result, hasUnresolved: unresolvedVars.length > 0, unresolvedVars }
}

// ── buildUrl ───────────────────────────────────────────────────────────────

/**
 * Interpolate a URL template. Strips any inline query string from the base
 * URL (params come from the params table). Throws if the final URL is invalid.
 */
export function buildUrl(
  urlTemplate: string,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): string {
  // Interpolate first
  const interpolated = interpolate(urlTemplate, scopes, dynamicVars)

  // Strip inline query string — params come from KV table
  const questionIdx = interpolated.indexOf('?')
  const base = questionIdx !== -1 ? interpolated.slice(0, questionIdx) : interpolated

  // Validate: must be parseable as a URL (allow relative-protocol // as shorthand)
  try {
    new URL(base)
  } catch {
    throw new Error(`Invalid URL after interpolation: "${base}"`)
  }

  return base
}

// ── buildHeaders ───────────────────────────────────────────────────────────

/**
 * Interpolate both key and value for a list of KV header pairs.
 * Only enabled pairs are included.
 */
export function buildHeaders(
  headers: Array<{ key: string; value: string; enabled: boolean }>,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const h of headers) {
    if (!h.enabled) continue
    const key = interpolate(h.key, scopes, dynamicVars).trim()
    const value = interpolate(h.value, scopes, dynamicVars)
    if (key) result[key] = value
  }
  return result
}

/**
 * Interpolate both key and value for a list of KV query param pairs.
 * Only enabled pairs are included.
 */
export function buildParams(
  params: Array<{ key: string; value: string; enabled: boolean }>,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const p of params) {
    if (!p.enabled) continue
    const key = interpolate(p.key, scopes, dynamicVars).trim()
    const value = interpolate(p.value, scopes, dynamicVars)
    if (key) result[key] = value
  }
  return result
}
