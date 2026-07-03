import { z } from 'zod'

// ── Shared primitives ──────────────────────────────────────────────────────

const nonEmpty = z.string().trim().min(1)

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const kvPairSchema = z.object({
  key: z.string().default(''),
  value: z.string().default(''),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  // Form-data file upload fields — must survive Zod validation so body-builder can act on them
  type: z.enum(['text', 'file']).optional(),
  fileName: z.string().max(255).optional(),
  fileMimeType: z.string().max(255).optional(),
})

const variableSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  secret: z.boolean().optional().default(false),
})

const reqBodySchema = z.object({
  type: z.enum(['none', 'json', 'raw', 'form-data', 'x-www-form-urlencoded', 'graphql']),
  content: z.string().default(''),
  formData: z.array(kvPairSchema).max(100).optional(),
  rawType: z.enum(['text', 'json', 'javascript', 'html', 'xml']).optional(),
  graphqlQuery: z.string().optional(),
  graphqlVariables: z.string().optional(),
  graphqlOperationName: z.string().optional(),
})

const reqAuthSchema = z.object({
  type: z.enum(['none', 'bearer', 'basic', 'api-key', 'oauth2', 'oauth1', 'aws-sig-v4']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeyHeader: z.string().optional(),
  oauth2GrantType: z.enum(['client_credentials', 'password', 'authorization_code']).optional(),
  oauth2TokenUrl: z.string().optional(),
  oauth2ClientId: z.string().optional(),
  oauth2ClientSecret: z.string().optional(),
  oauth2Scope: z.string().optional(),
  oauth2ClientAuth: z.enum(['body', 'basic_header']).optional(),
  oauth2Username: z.string().optional(),
  oauth2Password: z.string().optional(),
  oauth2AuthUrl: z.string().optional(),
  oauth2RedirectUri: z.string().optional(),
  oauth1ConsumerKey: z.string().optional(),
  oauth1ConsumerSecret: z.string().optional(),
  oauth1Token: z.string().optional(),
  oauth1TokenSecret: z.string().optional(),
  oauth1SignatureMethod: z.enum(['HMAC-SHA1', 'HMAC-SHA256']).optional(),
  oauth1Realm: z.string().optional(),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsSessionToken: z.string().optional(),
  awsRegion: z.string().optional(),
  awsService: z.string().optional(),
})

// ── Auth ───────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// ── Collections ────────────────────────────────────────────────────────────

export const createCollectionSchema = z.object({
  name: nonEmpty.max(200),
  description: z.string().max(1000).optional(),
})

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  variables: z.array(variableSchema).max(200).optional(),
  preRequestScript: z.string().max(10_000).optional(),
  postRequestScript: z.string().max(10_000).optional(),
})

// ── Folders ────────────────────────────────────────────────────────────────

export const createFolderSchema = z.object({
  collectionId: nonEmpty,
  parentFolderId: z.string().optional(),
  name: nonEmpty.max(200),
})

export const updateFolderSchema = z.object({
  name: nonEmpty.max(200),
  parentFolderId: z.string().nullable().optional(),
})

// ── Requests ───────────────────────────────────────────────────────────────

export const createRequestSchema = z.object({
  collectionId: nonEmpty,
  folderId: z.string().optional(),
  name: nonEmpty.max(200),
  method: z.enum(HTTP_METHODS).default('GET'),
  url: z.string().default(''),
  params: z.array(kvPairSchema).max(100).optional(),
  headers: z.array(kvPairSchema).max(100).optional(),
  body: reqBodySchema.optional(),
  auth: reqAuthSchema.optional(),
  preRequestScript: z.string().optional(),
  postRequestScript: z.string().optional(),
})

export const updateRequestSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().nullable().optional(),
  method: z.enum(HTTP_METHODS).optional(),
  url: z.string().optional(),
  params: z.array(kvPairSchema).max(100).optional(),
  headers: z.array(kvPairSchema).max(100).optional(),
  body: reqBodySchema.optional(),
  auth: reqAuthSchema.optional(),
  preRequestScript: z.string().optional(),
  postRequestScript: z.string().optional(),
})

export const createRequestVersionSchema = z.object({
  label: z.string().trim().max(200).optional(),
  method: z.enum(HTTP_METHODS),
  url: z.string(),
  params: z.array(kvPairSchema).max(100).default([]),
  headers: z.array(kvPairSchema).max(100).default([]),
  body: reqBodySchema,
  auth: reqAuthSchema,
  preRequestScript: z.string().default(''),
  postRequestScript: z.string().default(''),
})

export const requestVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateRequestVersionInput = z.infer<typeof createRequestVersionSchema>

// ── Environments ───────────────────────────────────────────────────────────

export const createEnvironmentSchema = z.object({
  name: nonEmpty.max(200),
  variables: z.array(variableSchema).max(200).default([]),
})

export const updateEnvironmentSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  variables: z.array(variableSchema).max(200).optional(),
})

// ── Workspaces ─────────────────────────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['personal', 'team']).default('personal'),
  description: z.string().trim().max(500).optional(),
})

export const patchWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['personal', 'team']).optional(),
  description: z.string().trim().max(500).nullable().optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: z.enum(['personal', 'team']).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  globalVariables: z.array(variableSchema).max(200).optional(),
  activeEnvironmentId: z.string().nullable().optional(),
})

const workspaceRoleEnum = z.enum(['admin', 'editor', 'viewer'])

export const inviteMemberSchema = z.object({
  email: z.string().trim().email(),
  role: workspaceRoleEnum,
})

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleEnum,
})

// ── Execute ────────────────────────────────────────────────────────────────

export const executeSchema = z.object({
  method: z.enum(HTTP_METHODS),
  url: nonEmpty,
  params: z.array(kvPairSchema).max(100).optional(),
  headers: z.array(kvPairSchema).max(100).optional(),
  body: reqBodySchema.optional(),
  auth: reqAuthSchema.optional(),
  preRequestScript: z.string().optional(),
  postRequestScript: z.string().optional(),
  workspaceId: nonEmpty,
  environmentId: z.string().optional(),
  collectionId: z.string().optional(),
  requestId: z.string().optional(),
  scopes: z.object({
    local: z.record(z.string()).optional(),
    data: z.record(z.string()).optional(),
  }).optional(),
  // Per-request execution settings
  timeout: z.number().int().min(1000).max(300_000).optional(),
  followRedirects: z.boolean().optional(),
  maxRedirects: z.number().int().min(0).max(20).optional(),
  sendCookies: z.boolean().optional(),
  saveCookies: z.boolean().optional(),
  sslVerify: z.boolean().optional(),
})

export type ExecuteInput = z.infer<typeof executeSchema>

// ── Runner ─────────────────────────────────────────────────────────────────

export const runnerSchema = z.object({
  collectionId: nonEmpty,
  environmentId: z.string().optional(),
  /** Each object is one iteration's data scope. Empty array = single pass. */
  dataRows: z.array(z.record(z.string())).max(1000).default([]),
})

export type RunnerInput = z.infer<typeof runnerSchema>

// ── Test Suites ────────────────────────────────────────────────────────────

export const createTestSuiteSchema = z.object({
  collectionId: nonEmpty,
  name: nonEmpty.max(200),
  description: z.string().max(1000).optional(),
  environmentId: z.string().optional(),
  dataRows: z.array(z.record(z.string())).max(1000).default([]),
})

export const updateTestSuiteSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  environmentId: z.string().nullable().optional(),
  dataRows: z.array(z.record(z.string())).max(1000).optional(),
})

export const testRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type CreateTestSuiteInput = z.infer<typeof createTestSuiteSchema>
export type UpdateTestSuiteInput = z.infer<typeof updateTestSuiteSchema>

// ── Flows ──────────────────────────────────────────────────────────────────

const nodeTypeEnum = z.enum([
  'navigate',
  'click_text', 'click_role', 'click_placeholder', 'click_title', 'hover_text',
  'fill_placeholder', 'fill_label', 'select_option',
  'assert_url', 'assert_visible', 'assert_not_visible', 'assert_value', 'assert_api_response',
  'wait_ms', 'wait_selector',
  'screenshot',
  'press_key', 'handle_dialog', 'upload_file', 'drag_drop', 'click_new_tab',
])

const flowNodeDataSchema = z.object({
  type: nodeTypeEnum,
  label: z.string(),
  url: z.string().optional(),
  text: z.string().optional(),
  role: z.enum(['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'option', 'heading']).optional(),
  roleName: z.string().optional(),
  placeholder: z.string().optional(),
  value: z.string().optional(),
  labelText: z.string().optional(),
  pattern: z.string().optional(),
  ms: z.number().int().min(0).max(60000).optional(),
  screenshotName: z.string().optional(),
  title: z.string().optional(),
  option: z.string().optional(),
  testId: z.string().optional(),
  selector: z.string().optional(),
  frameSelector: z.string().optional(),
  key: z.string().optional(),
  dialogAction: z.enum(['accept', 'dismiss']).optional(),
  promptText: z.string().optional(),
  filePath: z.string().optional(),
  targetSelector: z.string().optional(),
  apiUrlPattern: z.string().optional(),
  apiExpectedStatus: z.number().int().min(100).max(599).optional(),
})

export const flowNodeSchema = z.object({
  id: nonEmpty,
  type: z.literal('action'),
  position: z.object({ x: z.number(), y: z.number() }),
  data: flowNodeDataSchema,
})

export const flowEdgeSchema = z.object({
  id: nonEmpty,
  source: nonEmpty,
  target: nonEmpty,
  label: z.string().optional(),
  data: z.object({
    condition: z.enum(['always', 'if_visible', 'if_not_visible']).default('always'),
    conditionText: z.string().optional(),
  }).optional(),
})

const flowBrowserEnum = z.enum(['chromium', 'firefox', 'webkit'])

export const createFlowSchema = z.object({
  name: nonEmpty.max(200),
  description: z.string().max(1000).optional(),
  nodes: z.array(flowNodeSchema).max(200).default([]),
  edges: z.array(flowEdgeSchema).max(500).default([]),
})

export const updateFlowSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  nodes: z.array(flowNodeSchema).max(200).optional(),
  edges: z.array(flowEdgeSchema).max(500).optional(),
  browsers: z.array(flowBrowserEnum).min(1).max(3).optional(),
  environmentId: z.string().nullable().optional(),
  // 5s to 10min — a flow with many nodes/browsers may legitimately need longer than the 120s default.
  timeoutMs: z.number().int().min(5_000).max(600_000).optional(),
})

export const flowRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const createFlowVersionSchema = z.object({
  label: z.string().trim().max(200).optional(),
  nodes: z.array(flowNodeSchema).max(200),
  edges: z.array(flowEdgeSchema).max(500),
})

export const flowVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>
export type CreateFlowVersionInput = z.infer<typeof createFlowVersionSchema>

// ── Examples ───────────────────────────────────────────────────────────────

export const createExampleSchema = z.object({
  name: nonEmpty.max(200),
  status: z.number().int().optional(),
  statusText: z.string().optional(),
  responseHeaders: z.record(z.string()).optional(),
  responseBody: z.string().max(51_200).optional(),
  durationMs: z.number().int().optional(),
  size: z.number().int().optional(),
  // Request snapshot
  requestMethod: z.string().max(16).optional(),
  requestUrl: z.string().max(4096).optional(),
  requestParams: z.array(kvPairSchema).optional(),
  requestHeaders: z.array(kvPairSchema).optional(),
  requestBody: reqBodySchema.optional(),
  requestAuth: reqAuthSchema.optional(),
})

export const renameExampleSchema = z.object({
  name: nonEmpty.max(200),
})

export type CreateExampleInput = z.infer<typeof createExampleSchema>
export type RenameExampleInput = z.infer<typeof renameExampleSchema>
