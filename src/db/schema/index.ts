// ── Shared TypeScript types used by multiple schema files and app code ───────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type BodyType = 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded'
export type RawBodyType = 'text' | 'json' | 'javascript' | 'html' | 'xml'
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key'

export interface Variable {
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

export interface KeyValuePair {
  key: string
  value: string
  enabled: boolean
  description?: string
}

export interface RequestBody {
  type: BodyType
  content: string
  rawType?: RawBodyType
  formData?: KeyValuePair[]
}

export interface RequestAuth {
  type: AuthType
  token?: string
  username?: string
  password?: string
  apiKey?: string
  apiKeyHeader?: string
}

// ── Re-export all tables ──────────────────────────────────────────────────────
export { users } from './users'
export { workspaces } from './workspaces'
export { collections } from './collections'
export { folders } from './folders'
export { requests } from './requests'
export { environments } from './environments'
export { history } from './history'
