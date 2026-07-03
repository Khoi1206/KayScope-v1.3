import type { RequestAuth } from '@/db/schema'
import { interpolate } from '@/core/interpolation/engine'
import type { ScopeSet } from '@/core/interpolation/scope'
import type { DynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'
import { buildOAuth1Header } from './oauth1-sign'
import { buildAwsSigV4Headers } from './aws-sig-v4'

/**
 * Context needed by signing auth types (oauth1, aws-sig-v4) that sign over the
 * final method/URL/headers/body — unlike bearer/basic/api-key/oauth2, which only
 * need the scope-resolved auth fields. Optional and ignored by those 4 cases.
 */
export interface AuthSigningContext {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}

/**
 * Resolve the Authorization headers for the given auth config.
 * Returns a partial record of headers to merge into the request.
 */
export function resolveAuthHeaders(
  auth: RequestAuth | undefined | null,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot,
  signingCtx?: AuthSigningContext
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

    case 'oauth2': {
      // Token is pre-fetched by executor (client_credentials) or provided via local scope
      const token = scopes.local?.['_oauth2_token'] ?? ''
      return token ? { Authorization: `Bearer ${token}` } : {}
    }

    case 'oauth1': {
      const consumerKey = interpolate(auth.oauth1ConsumerKey ?? '', scopes, dynamicVars)
      const consumerSecret = interpolate(auth.oauth1ConsumerSecret ?? '', scopes, dynamicVars)
      if (!consumerKey || !consumerSecret || !signingCtx) return {}
      const token = interpolate(auth.oauth1Token ?? '', scopes, dynamicVars)
      const tokenSecret = interpolate(auth.oauth1TokenSecret ?? '', scopes, dynamicVars)
      const realm = interpolate(auth.oauth1Realm ?? '', scopes, dynamicVars)
      const header = buildOAuth1Header({
        method: signingCtx.method,
        url: signingCtx.url,
        consumerKey,
        consumerSecret,
        token: token || undefined,
        tokenSecret: tokenSecret || undefined,
        signatureMethod: auth.oauth1SignatureMethod ?? 'HMAC-SHA1',
        realm: realm || undefined,
      })
      return { Authorization: header }
    }

    case 'aws-sig-v4': {
      const accessKeyId = interpolate(auth.awsAccessKeyId ?? '', scopes, dynamicVars)
      const secretAccessKey = interpolate(auth.awsSecretAccessKey ?? '', scopes, dynamicVars)
      const region = interpolate(auth.awsRegion ?? '', scopes, dynamicVars)
      const service = interpolate(auth.awsService ?? '', scopes, dynamicVars)
      if (!accessKeyId || !secretAccessKey || !region || !service || !signingCtx) return {}
      const sessionToken = interpolate(auth.awsSessionToken ?? '', scopes, dynamicVars)
      return buildAwsSigV4Headers({
        method: signingCtx.method,
        url: signingCtx.url,
        headers: signingCtx.headers,
        body: signingCtx.body,
        accessKeyId,
        secretAccessKey,
        sessionToken: sessionToken || undefined,
        region,
        service,
      })
    }

    default:
      return {}
  }
}
