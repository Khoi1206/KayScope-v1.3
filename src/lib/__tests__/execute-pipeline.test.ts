/**
 * Integration tests for the execute pipeline logic:
 * - scope assembly (decrypt variables → build scopes)
 * - secret masking (secrets never leak to client)
 * - pre-script failure stops execution
 * - variable crypto (encrypt/decrypt roundtrip in context of Variable[])
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { encryptValue, maskValue } from '@/lib/crypto'
import { decryptVariables, encryptVariables, maskVariables } from '@/lib/execute/variable-crypto'
import { mergeScopes, emptyScopes, toServerScopes } from '@/core/interpolation/scope'
import { interpolate, interpolateWithStatus, extractVarNames, buildHeaders } from '@/core/interpolation/engine'
import { executeScript } from '@/lib/scripting/sandbox'
import type { Variable } from '@/db/schema'

const KEY = 'b'.repeat(64)

beforeEach(() => {
  process.env.VAR_ENCRYPTION_KEY = KEY
})

// ── Variable crypto (pipeline step: decrypt DB vars) ──────────────────────

describe('decryptVariables — pipeline scope assembly', () => {
  it('decrypts encrypted secrets into plaintext for execution', () => {
    const vars: Variable[] = [
      { key: 'API_KEY', value: encryptValue('sk-abc123'), enabled: true, secret: true },
      { key: 'BASE_URL', value: 'https://api.example.com', enabled: true, secret: false },
    ]
    const result = decryptVariables(vars)
    expect(result['API_KEY']).toBe('sk-abc123')
    expect(result['BASE_URL']).toBe('https://api.example.com')
  })

  it('skips disabled variables', () => {
    const vars: Variable[] = [
      { key: 'ENABLED', value: 'yes', enabled: true, secret: false },
      { key: 'DISABLED', value: 'no', enabled: false, secret: false },
    ]
    const result = decryptVariables(vars)
    expect(result['ENABLED']).toBe('yes')
    expect(result['DISABLED']).toBeUndefined()
  })

  it('passes through plaintext non-secret values unchanged', () => {
    const vars: Variable[] = [
      { key: 'HOST', value: 'localhost', enabled: true, secret: false },
    ]
    expect(decryptVariables(vars)['HOST']).toBe('localhost')
  })
})

describe('maskVariables — secrets never leave server as plaintext', () => {
  it('masks secret variable values', () => {
    const vars: Variable[] = [
      { key: 'TOKEN', value: encryptValue('real-token'), enabled: true, secret: true },
      { key: 'ENV', value: 'prod', enabled: true, secret: false },
    ]
    const masked = maskVariables(vars)
    expect(masked.find(v => v.key === 'TOKEN')?.value).toBe(maskValue())
    expect(masked.find(v => v.key === 'ENV')?.value).toBe('prod')
  })

  it('never returns plaintext for secret variables', () => {
    const plaintext = 'super-secret'
    const vars: Variable[] = [
      { key: 'S', value: plaintext, enabled: true, secret: true },
    ]
    const masked = maskVariables(vars)
    expect(masked[0]!.value).not.toBe(plaintext)
  })
})

describe('encryptVariables — preserve mask on unchanged secrets', () => {
  it('re-uses existing encrypted value when mask is sent back', () => {
    const existingEncrypted = encryptValue('original')
    const existing: Variable[] = [
      { key: 'S', value: existingEncrypted, enabled: true, secret: true },
    ]
    const incoming: Variable[] = [
      { key: 'S', value: maskValue(), enabled: true, secret: true },
    ]
    const result = encryptVariables(incoming, existing)
    expect(result[0]!.value).toBe(existingEncrypted)
  })

  it('encrypts new secret value', () => {
    const result = encryptVariables(
      [{ key: 'NEW', value: 'new-secret', enabled: true, secret: true }],
      []
    )
    expect(result[0]!.value).toMatch(/^enc:/)
  })

  it('leaves non-secret values unchanged', () => {
    const result = encryptVariables(
      [{ key: 'HOST', value: 'localhost', enabled: true, secret: false }],
      []
    )
    expect(result[0]!.value).toBe('localhost')
  })
})

// ── Scope assembly (pipeline step: build full scopes from DB + payload) ────

describe('scope assembly — mergeScopes for execute pipeline', () => {
  it('env > collection > global with correct priority', () => {
    const globalVars = { base: 'global', shared: 'global' }
    const collectionVars = { shared: 'collection', col: 'collection' }
    const envVars = { shared: 'env', env: 'env' }

    const scopes = mergeScopes(emptyScopes(), {
      global: globalVars,
      collection: collectionVars,
      environment: envVars,
    })

    expect(scopes.environment.shared).toBe('env')
    expect(scopes.collection.col).toBe('collection')
    expect(scopes.global.base).toBe('global')
  })

  it('toServerScopes returns local and data scopes', () => {
    const clientScopes = mergeScopes(emptyScopes(), {
      local: { a: 'local', b: 'from-local' },
      data: { row: 'csv-val' },
    })
    const result = toServerScopes(clientScopes)
    expect(result.local).toEqual({ a: 'local', b: 'from-local' })
    expect(result.data).toEqual({ row: 'csv-val' })
  })

  it('interpolate resolves variables from scope', () => {
    const scopes = mergeScopes(emptyScopes(), {
      environment: { host: 'api.example.com' },
      local: { version: 'v2' },
    })
    const result = interpolate('https://{{host}}/{{version}}/users', scopes)
    expect(result).toBe('https://api.example.com/v2/users')
  })

  it('unresolved variable stays as {{name}} not empty string', () => {
    const scopes = emptyScopes()
    const result = interpolate('https://{{missing}}.example.com', scopes)
    expect(result).toBe('https://{{missing}}.example.com')
    expect(result).not.toContain('undefined')
  })

  it('interpolateWithStatus reports hasUnresolved for missing vars', () => {
    const scopes = emptyScopes()
    const { result, hasUnresolved, unresolvedVars } = interpolateWithStatus('GET {{token}}', scopes)
    expect(hasUnresolved).toBe(true)
    expect(unresolvedVars).toContain('token')
    expect(result).toContain('{{token}}')
  })

  it('buildHeaders interpolates both keys and values', () => {
    const scopes = mergeScopes(emptyScopes(), { local: { authType: 'Bearer', tok: 'abc' } })
    const pairs = [{ key: 'Authorization', value: '{{authType}} {{tok}}', enabled: true }]
    const headers = buildHeaders(pairs, scopes)
    expect(headers['Authorization']).toBe('Bearer abc')
  })

  it('extractVarNames finds all {{tokens}} in a string', () => {
    const names = extractVarNames('{{baseUrl}}/{{version}}/{{$guid}}')
    expect(names).toContain('baseUrl')
    expect(names).toContain('version')
    expect(names).toContain('$guid')
  })
})

// ── Pre-script failure stops execution ────────────────────────────────────

describe('pre-script failure — stops execute flow', () => {
  it('script that throws returns an error', async () => {
    const result = await executeScript(
      'throw new Error("pre-script failed")',
      { local: {}, environment: {}, collection: {}, global: {}, request: { method: 'GET', url: 'http://x', headers: {}, body: null } }
    )
    expect(result.error).toContain('pre-script failed')
  })

  it('successful pre-script returns no error', async () => {
    const result = await executeScript(
      'pm.variables.set("x", "1")',
      { local: {}, environment: {}, collection: {}, global: {}, request: { method: 'GET', url: 'http://x', headers: {}, body: null } }
    )
    expect(result.error).toBeUndefined()
    expect(result.mutations.local['x']).toBe('1')
  })

  it('pre-script mutations are returned for carry-forward', async () => {
    const result = await executeScript(
      'pm.variables.set("token", "abc"); pm.environment.set("env_var", "value")',
      { local: {}, environment: {}, collection: {}, global: {}, request: { method: 'GET', url: 'http://x', headers: {}, body: null } }
    )
    expect(result.mutations.local['token']).toBe('abc')
    expect(result.mutations.environment['env_var']).toBe('value')
  })

  it('pm.test registers test results', async () => {
    const result = await executeScript(
      `pm.test("always passes", () => { pm.expect(1 + 1).to.equal(2) })`,
      { local: {}, environment: {}, collection: {}, global: {}, request: { method: 'GET', url: 'http://x', headers: {}, body: null } }
    )
    expect(result.tests[0]?.name).toBe('always passes')
    expect(result.tests[0]?.passed).toBe(true)
  })

  it('pm.test with failing assertion marks test as failed', async () => {
    const result = await executeScript(
      `pm.test("fails", () => { pm.expect(1).to.equal(2) })`,
      { local: {}, environment: {}, collection: {}, global: {}, request: { method: 'GET', url: 'http://x', headers: {}, body: null } }
    )
    expect(result.tests[0]?.passed).toBe(false)
    expect(result.tests[0]?.error).toBeTruthy()
  })

  it('console.log in pre-script is captured in logs', async () => {
    const result = await executeScript(
      'console.log("hello")\nconsole.warn("warning")',
      { local: {}, environment: {}, collection: {}, global: {}, request: { method: 'GET', url: 'http://x', headers: {}, body: null } }
    )
    expect(result.logs).toContain('hello')
    expect(result.logs).toContain('[warn] warning')
    expect(result.error).toBeUndefined()
  })
})
