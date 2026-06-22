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
  value: string           // text value OR uploadId when type === 'file'
  enabled: boolean
  description?: string
  type?: 'text' | 'file'
  fileName?: string       // original filename for display and Blob filename
  fileMimeType?: string   // MIME type for Blob construction
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
export { workspaces, type WorkspaceType } from './workspaces'
export { collections } from './collections'
export { folders } from './folders'
export { requests } from './requests'
export { environments } from './environments'
export { history } from './history'
export { testSuites } from './test_suites'
export { testRuns } from './test_runs'
export { flows, type NodeType, type FlowNodeData, type FlowNode, type FlowEdgeData, type FlowEdge, type FlowBrowser } from './flows'
export { flowRuns, type PlaywrightRunResult, type PlaywrightTestResult, type FlowRunSummary } from './flow_runs'
export { examples, type Example, type NewExample } from './examples'
