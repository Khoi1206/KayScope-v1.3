import { readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import type { RequestBody, KeyValuePair } from '@/db/schema'
import { interpolate } from '@/core/interpolation/engine'
import type { ScopeSet } from '@/core/interpolation/scope'
import type { DynamicVarSnapshot } from '@/core/interpolation/dynamic-vars'
import { FormData } from 'undici'

export interface BuiltBody {
  body: string | FormData | null
  contentType: string | null
}

/**
 * Build the HTTP request body from the request body config.
 * Returns { body, contentType } where contentType should be added to headers
 * (unless the user has explicitly set Content-Type in their headers table).
 */
export async function buildRequestBody(
  reqBody: RequestBody | undefined | null,
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): Promise<BuiltBody> {
  if (!reqBody || reqBody.type === 'none') {
    return { body: null, contentType: null }
  }

  switch (reqBody.type) {
    case 'json': {
      const content = interpolate(reqBody.content ?? '', scopes, dynamicVars)
      return { body: content, contentType: 'application/json' }
    }

    case 'raw': {
      const content = interpolate(reqBody.content ?? '', scopes, dynamicVars)
      const mime = rawTypeMime(reqBody.rawType)
      return { body: content, contentType: mime }
    }

    case 'form-data': {
      const form = new FormData()
      for (const pair of (reqBody.formData ?? [])) {
        if (!pair.enabled) continue
        const key = interpolate(pair.key, scopes, dynamicVars)
        if (!key) continue

        if (pair.type === 'file' && pair.value) {
          try {
            // Validate uploadId is a UUID to prevent path traversal before joining
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pair.value)) {
              continue
            }
            const filePath = join(tmpdir(), 'kayscope-' + pair.value)
            const buffer = await readFile(filePath)
            const blob = new Blob([buffer], { type: pair.fileMimeType || 'application/octet-stream' })
            form.append(key, blob, pair.fileName ?? 'upload')
          } catch {
            // Temp file missing — skip this part rather than aborting the whole request
          }
        } else {
          const value = interpolate(pair.value, scopes, dynamicVars)
          form.append(key, value)
        }
      }
      // Return the FormData object — undici's fetch sets Content-Type with boundary automatically
      return { body: form, contentType: null }
    }

    case 'x-www-form-urlencoded': {
      const params = new URLSearchParams()
      for (const pair of (reqBody.formData ?? [])) {
        if (!pair.enabled) continue
        const key = interpolate(pair.key, scopes, dynamicVars)
        const value = interpolate(pair.value, scopes, dynamicVars)
        if (key) params.append(key, value)
      }
      return {
        body: params.toString(),
        contentType: 'application/x-www-form-urlencoded',
      }
    }

    default:
      return { body: null, contentType: null }
  }
}

function rawTypeMime(rawType: RequestBody['rawType']): string {
  switch (rawType) {
    case 'json': return 'application/json'
    case 'javascript': return 'application/javascript'
    case 'html': return 'text/html'
    case 'xml': return 'application/xml'
    case 'text':
    default: return 'text/plain'
  }
}

/**
 * Serialize an array of KV pairs as URL-encoded query string.
 */
export function buildQueryString(
  params: KeyValuePair[],
  scopes: ScopeSet,
  dynamicVars?: DynamicVarSnapshot
): string {
  const parts: string[] = []
  for (const p of params) {
    if (!p.enabled) continue
    const key = interpolate(p.key, scopes, dynamicVars).trim()
    const value = interpolate(p.value, scopes, dynamicVars)
    if (key) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}
