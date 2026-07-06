// ── Shared TypeScript types used by multiple schema files and app code ───────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type BodyType = 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded' | 'graphql'
export type RawBodyType = 'text' | 'json' | 'javascript' | 'html' | 'xml'
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'oauth1' | 'aws-sig-v4'
export type OAuth2GrantType = 'client_credentials' | 'password' | 'authorization_code'
export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'HMAC-SHA256'

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
  // GraphQL
  graphqlQuery?: string
  graphqlVariables?: string
  graphqlOperationName?: string
}

export interface RequestAuth {
  type: AuthType
  // Bearer
  token?: string
  // Basic
  username?: string
  password?: string
  // API Key
  apiKey?: string
  apiKeyHeader?: string
  // OAuth2
  oauth2GrantType?: OAuth2GrantType
  oauth2TokenUrl?: string
  oauth2ClientId?: string
  oauth2ClientSecret?: string
  oauth2Scope?: string
  oauth2ClientAuth?: 'body' | 'basic_header'
  // Password grant
  oauth2Username?: string
  oauth2Password?: string
  // Authorization Code extras
  oauth2AuthUrl?: string
  oauth2RedirectUri?: string
  // OAuth1
  oauth1ConsumerKey?: string
  oauth1ConsumerSecret?: string
  oauth1Token?: string
  oauth1TokenSecret?: string
  oauth1SignatureMethod?: OAuth1SignatureMethod
  oauth1Realm?: string
  // AWS Signature v4
  awsAccessKeyId?: string
  awsSecretAccessKey?: string
  awsSessionToken?: string
  awsRegion?: string
  awsService?: string
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
export { flows, type NodeType, type FlowNodeData, type FlowNode, type FlowEdgeData, type FlowEdge, type FlowBrowser, type Flow, type NewFlow } from './flows'
export { flowRuns, type PlaywrightRunResult, type PlaywrightTestResult, type PlaywrightAttachment, type FlowRunSummary, type FlowRun, type NewFlowRun } from './flow_runs'
export { flowVersions, type FlowVersion, type NewFlowVersion } from './flow_versions'
export { requestVersions, type RequestVersion, type NewRequestVersion } from './request_versions'
export { activityLogs, type ActivityAction, type ActivityEntityType, type ActivityLog, type NewActivityLog } from './activity_logs'
export { workspaceMembers, type WorkspaceRole, type WorkspaceMember, type NewWorkspaceMember } from './workspace_members'
export { examples, type Example, type NewExample } from './examples'
export { cookies, type Cookie, type NewCookie } from './cookies'
export { adminAuditLogs, type AdminAuditAction, type AdminAuditLog, type NewAdminAuditLog } from './admin_audit_logs'
