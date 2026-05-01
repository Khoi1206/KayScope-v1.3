import { z } from 'zod'

// ── Shared primitives ──────────────────────────────────────────────────────

const nonEmpty = z.string().trim().min(1)

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const kvPairSchema = z.object({
  key: z.string().default(''),
  value: z.string().default(''),
  enabled: z.boolean().default(true),
  description: z.string().optional(),
})

const variableSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  secret: z.boolean().optional().default(false),
})

const reqBodySchema = z.object({
  type: z.enum(['none', 'json', 'raw', 'form-data', 'x-www-form-urlencoded']),
  content: z.string().default(''),
  formData: z.array(kvPairSchema).max(100).optional(),
  rawType: z.enum(['text', 'json', 'javascript', 'html', 'xml']).optional(),
})

const reqAuthSchema = z.object({
  type: z.enum(['none', 'bearer', 'basic', 'api-key']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  apiKeyHeader: z.string().optional(),
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
})

// ── Folders ────────────────────────────────────────────────────────────────

export const createFolderSchema = z.object({
  collectionId: nonEmpty,
  parentFolderId: z.string().optional(),
  name: nonEmpty.max(200),
})

export const updateFolderSchema = z.object({
  name: nonEmpty.max(200),
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

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  globalVariables: z.array(variableSchema).max(200).optional(),
  activeEnvironmentId: z.string().nullable().optional(),
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
  'assert_url', 'assert_visible', 'assert_not_visible', 'assert_value',
  'wait_ms', 'wait_selector',
  'screenshot',
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
})

const flowNodeSchema = z.object({
  id: nonEmpty,
  type: z.literal('action'),
  position: z.object({ x: z.number(), y: z.number() }),
  data: flowNodeDataSchema,
})

const flowEdgeSchema = z.object({
  id: nonEmpty,
  source: nonEmpty,
  target: nonEmpty,
  label: z.string().optional(),
  data: z.object({
    condition: z.enum(['always', 'if_visible', 'if_not_visible']).default('always'),
    conditionText: z.string().optional(),
  }).optional(),
})

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
})

export const flowRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>
