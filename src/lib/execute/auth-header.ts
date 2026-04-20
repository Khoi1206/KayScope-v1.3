import type { RequestAuth } from '@/db/schema'
import { interpolate } from '@/core/interpolation/engine'
import type { ScopeSet } from '@/core/interpolation/scope'
import type { DynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'

/**
 * Resolve the Authorization headers for the given auth config.
 * Returns a partial record of headers to merge into the request.
 */
export function resolveAuthHeaders(
  auth: RequestAuth | undefined | null,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): Record<string, string> {
  if (!auth || auth.type === 'none') return {}

  switch (auth.type) {
    case 'bearer': {
      const token = interpolate(auth.token ?? '', scopes, dynamicVars)
      return token ? { Authorization: `Bearer ${token}` } : {}
    }

    case 'basic': {
      const username = interpolate(auth.username ?? '', scopes, dynamicVars)
      const password = interpolate(auth.password ?? '', scopes, dynamicVars)
      if (!username) return {}
      const encoded = Buffer.from(`${username}:${password}`).toString('base64')
      return { Authorization: `Basic ${encoded}` }
    }

    case 'api-key': {
      const key = interpolate(auth.apiKey ?? '', scopes, dynamicVars)
      const header = interpolate(auth.apiKeyHeader ?? 'X-API-Key', scopes, dynamicVars)
      return key && header ? { [header]: key } : {}
    }

    default:
      return {}
  }
}
