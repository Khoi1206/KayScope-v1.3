import { describe, it, expect } from 'vitest'
import { executeScript } from '@/lib/scripting/sandbox'
import type { ScriptContext } from '@/lib/scripting/sandbox'

function baseCtx(overrides: Partial<ScriptContext> = {}): ScriptContext {
  return {
    local: {},
    environment: {},
    collection: {},
    global: {},
    request: { method: 'GET', url: 'https://example.com', headers: {}, body: null },
    ...overrides,
  }
}

// ── Basic execution ────────────────────────────────────────────────────────

describe('executeScript — basic execution', () => {
  it('runs a script that produces no side-effects', async () => {
    const result = await executeScript('const x = 1 + 1;', baseCtx())
    expect(result.error).toBeUndefined()
    expect(result.tests).toEqual([])
    expect(result.logs).toEqual([])
  })

  it('captures error for script that throws', async () => {
    const result = await executeScript('throw new Error("boom");', baseCtx())
    expect(result.error).toContain('boom')
  })

  it('captures error for syntax error in script', async () => {
    const result = await executeScript('const = bad;', baseCtx())
    expect(result.error).toBeTruthy()
  })

  it('returns empty mutations when script does nothing', async () => {
    const result = await executeScript('// noop', baseCtx())
    expect(result.mutations.local).toEqual({})
    expect(result.mutations.environment).toEqual({})
    expect(result.mutations.collection).toEqual({})
    expect(result.mutations.global).toEqual({})
  })
})

// ── pm.variables ──────────────────────────────────────────────────────────

describe('executeScript — pm.variables', () => {
  it('set() and get() work for local scope', async () => {
    const result = await executeScript(
      'pm.variables.set("myKey", "myValue");',
      baseCtx()
    )
    expect(result.mutations.local.myKey).toBe('myValue')
  })

  it('get() reads from the context local scope', async () => {
    const result = await executeScript(
      'pm.variables.set("echo", pm.variables.get("input"));',
      baseCtx({ local: { input: 'hello' } })
    )
    expect(result.mutations.local.echo).toBe('hello')
  })

  it('has() returns true for existing key', async () => {
    const result = await executeScript(
      'pm.variables.set("exists", pm.variables.has("existing") ? "yes" : "no");',
      baseCtx({ local: { existing: '1' } })
    )
    expect(result.mutations.local.exists).toBe('yes')
  })

  it('has() returns false for missing key', async () => {
    const result = await executeScript(
      'pm.variables.set("flag", pm.variables.has("missing") ? "yes" : "no");',
      baseCtx()
    )
    expect(result.mutations.local.flag).toBe('no')
  })

  it('replaceIn() substitutes variables in a string', async () => {
    const result = await executeScript(
      'pm.variables.set("url", pm.variables.replaceIn("https://{{host}}/api"));',
      baseCtx({ local: { host: 'api.example.com' } })
    )
    expect(result.mutations.local.url).toBe('https://api.example.com/api')
  })

  it('replaceIn() leaves unresolved tokens intact', async () => {
    const result = await executeScript(
      'pm.variables.set("val", pm.variables.replaceIn("{{missing}}"));',
      baseCtx()
    )
    expect(result.mutations.local.val).toBe('{{missing}}')
  })
})

// ── pm.environment ────────────────────────────────────────────────────────

describe('executeScript — pm.environment', () => {
  it('set() mutates environment scope', async () => {
    const result = await executeScript(
      'pm.environment.set("env_key", "env_val");',
      baseCtx()
    )
    expect(result.mutations.environment.env_key).toBe('env_val')
  })

  it('get() reads from context environment', async () => {
    const result = await executeScript(
      'pm.variables.set("captured", pm.environment.get("token"));',
      baseCtx({ environment: { token: 'env-token' } })
    )
    expect(result.mutations.local.captured).toBe('env-token')
  })
})

// ── pm.collectionVariables ────────────────────────────────────────────────

describe('executeScript — pm.collectionVariables', () => {
  it('set() mutates collection scope', async () => {
    const result = await executeScript(
      'pm.collectionVariables.set("baseUrl", "https://new.example.com");',
      baseCtx()
    )
    expect(result.mutations.collection.baseUrl).toBe('https://new.example.com')
  })

  it('get() reads from context collection', async () => {
    const result = await executeScript(
      'pm.variables.set("v", pm.collectionVariables.get("colVar"));',
      baseCtx({ collection: { colVar: 'colValue' } })
    )
    expect(result.mutations.local.v).toBe('colValue')
  })
})

// ── pm.globals ────────────────────────────────────────────────────────────

describe('executeScript — pm.globals', () => {
  it('set() mutates global scope', async () => {
    const result = await executeScript(
      'pm.globals.set("globalKey", "globalVal");',
      baseCtx()
    )
    expect(result.mutations.global.globalKey).toBe('globalVal')
  })
})

// ── pm.test ────────────────────────────────────────────────────────────────

describe('executeScript — pm.test', () => {
  it('records a passing test', async () => {
    const result = await executeScript(
      'pm.test("1 + 1 = 2", () => { pm.expect(1 + 1).to.equal(2); });',
      baseCtx()
    )
    expect(result.tests).toHaveLength(1)
    expect(result.tests[0]!.name).toBe('1 + 1 = 2')
    expect(result.tests[0]!.passed).toBe(true)
  })

  it('records a failing test with an error message', async () => {
    const result = await executeScript(
      'pm.test("should fail", () => { pm.expect(1).to.equal(2); });',
      baseCtx()
    )
    expect(result.tests[0]!.passed).toBe(false)
    expect(result.tests[0]!.error).toBeTruthy()
  })

  it('records multiple tests independently', async () => {
    const result = await executeScript(`
      pm.test("pass", () => { pm.expect(1).to.equal(1); });
      pm.test("fail", () => { pm.expect(1).to.equal(99); });
    `, baseCtx())
    expect(result.tests).toHaveLength(2)
    expect(result.tests[0]!.passed).toBe(true)
    expect(result.tests[1]!.passed).toBe(false)
  })

  it('continues running after a failed test', async () => {
    const result = await executeScript(`
      pm.test("fail", () => { throw new Error("x"); });
      pm.test("pass", () => { pm.expect(true).to.be.true(); });
    `, baseCtx())
    expect(result.tests).toHaveLength(2)
    expect(result.tests[1]!.passed).toBe(true)
  })
})

// ── pm.expect matchers ────────────────────────────────────────────────────

describe('executeScript — pm.expect matchers', () => {
  async function runExpect(expr: string) {
    return executeScript(
      `pm.test("t", () => { ${expr} });`,
      baseCtx()
    )
  }

  it('to.equal passes for same primitive', async () => {
    const r = await runExpect('pm.expect("abc").to.equal("abc");')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.equal fails for different values', async () => {
    const r = await runExpect('pm.expect("abc").to.equal("xyz");')
    expect(r.tests[0]!.passed).toBe(false)
  })

  it('to.include passes when string contains substring', async () => {
    const r = await runExpect('pm.expect("hello world").to.include("world");')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.match passes for matching regex', async () => {
    const r = await runExpect('pm.expect("test123").to.match(/\\d+/);')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.be.ok passes for truthy value', async () => {
    const r = await runExpect('pm.expect("truthy").to.be.ok();')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.be.true passes for true', async () => {
    const r = await runExpect('pm.expect(true).to.be.true();')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.be.false passes for false', async () => {
    const r = await runExpect('pm.expect(false).to.be.false();')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.be.above passes when value > n', async () => {
    const r = await runExpect('pm.expect(5).to.be.above(4);')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.be.below passes when value < n', async () => {
    const r = await runExpect('pm.expect(3).to.be.below(4);')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.be.within passes for value in range', async () => {
    const r = await runExpect('pm.expect(5).to.be.within(1, 10);')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.have.length passes for correct length', async () => {
    const r = await runExpect('pm.expect("abc").to.have.length(3);')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.have.property passes when object has key', async () => {
    const r = await runExpect('pm.expect({a:1}).to.have.property("a");')
    expect(r.tests[0]!.passed).toBe(true)
  })

  it('to.have.property with value passes when value matches', async () => {
    const r = await runExpect('pm.expect({a:1}).to.have.property("a", 1);')
    expect(r.tests[0]!.passed).toBe(true)
  })
})

// ── console logging ────────────────────────────────────────────────────────

describe('executeScript — console logging', () => {
  it('captures console.log output', async () => {
    const result = await executeScript(
      'console.log("hello", "world");',
      baseCtx()
    )
    expect(result.logs).toContain('hello world')
  })

  it('captures console.warn with prefix', async () => {
    const result = await executeScript('console.warn("warning msg");', baseCtx())
    expect(result.logs[0]).toContain('warning msg')
    expect(result.logs[0]).toContain('[warn]')
  })

  it('captures console.error with prefix', async () => {
    const result = await executeScript('console.error("err msg");', baseCtx())
    expect(result.logs[0]).toContain('[error]')
  })
})

// ── pm.request mutations ──────────────────────────────────────────────────

describe('executeScript — pm.request mutations', () => {
  it('setHeader() records header mutation', async () => {
    const result = await executeScript(
      'pm.request.setHeader("X-Custom", "custom-value");',
      baseCtx()
    )
    // requestMutations is returned at the top level of ScriptResult
    expect(result.requestMutations?.headers['X-Custom']).toBe('custom-value')
  })

  it('setBody() records body mutation', async () => {
    const result = await executeScript(
      'pm.request.setBody(\'{"injected":true}\');',
      baseCtx()
    )
    expect(result.requestMutations?.body).toBe('{"injected":true}')
  })

  it('pm.request exposes method and url from context', async () => {
    const result = await executeScript(
      'pm.variables.set("m", pm.request.method); pm.variables.set("u", pm.request.url);',
      baseCtx({ request: { method: 'POST', url: 'https://api.test', headers: {}, body: null } })
    )
    expect(result.mutations.local.m).toBe('POST')
    expect(result.mutations.local.u).toBe('https://api.test')
  })
})

// ── Post-request script with pm.response ─────────────────────────────────

describe('executeScript — pm.response (post-request)', () => {
  const response = {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: '{"id":1,"name":"Alice"}',
    durationMs: 123,
  }

  it('pm.response.status is accessible', async () => {
    const result = await executeScript(
      'pm.variables.set("s", String(pm.response.status));',
      baseCtx(),
      response
    )
    expect(result.mutations.local.s).toBe('200')
  })

  it('pm.response.json() parses JSON body', async () => {
    const result = await executeScript(
      'const body = pm.response.json(); pm.variables.set("name", body.name);',
      baseCtx(),
      response
    )
    expect(result.mutations.local.name).toBe('Alice')
  })

  it('pm.response.text() returns raw body string', async () => {
    const result = await executeScript(
      'pm.variables.set("raw", pm.response.text());',
      baseCtx(),
      response
    )
    expect(result.mutations.local.raw).toBe('{"id":1,"name":"Alice"}')
  })

  it('pm.response.headers.get() returns header value', async () => {
    const result = await executeScript(
      'pm.variables.set("ct", pm.response.headers.get("content-type"));',
      baseCtx(),
      response
    )
    expect(result.mutations.local.ct).toBe('application/json')
  })

  it('pm.response.to.have.status() test passes for correct status', async () => {
    const result = await executeScript(
      'pm.test("status 200", () => { pm.response.to.have.status(200); });',
      baseCtx(),
      response
    )
    expect(result.tests[0]!.passed).toBe(true)
  })

  it('pm.response.to.have.status() test fails for wrong status', async () => {
    const result = await executeScript(
      'pm.test("status 404", () => { pm.response.to.have.status(404); });',
      baseCtx(),
      response
    )
    expect(result.tests[0]!.passed).toBe(false)
  })
})

// ── pm.iterationData ──────────────────────────────────────────────────────

describe('executeScript — pm.iterationData', () => {
  it('get() reads from iteration data row', async () => {
    const result = await executeScript(
      'pm.variables.set("email", pm.iterationData.get("email"));',
      baseCtx({ iterationData: { email: 'test@example.com' } })
    )
    expect(result.mutations.local.email).toBe('test@example.com')
  })

  it('has() returns true for existing data key', async () => {
    const result = await executeScript(
      'pm.variables.set("flag", pm.iterationData.has("email") ? "yes" : "no");',
      baseCtx({ iterationData: { email: 'x@y.com' } })
    )
    expect(result.mutations.local.flag).toBe('yes')
  })
})

// ── pm.execution ──────────────────────────────────────────────────────────

describe('executeScript — pm.execution', () => {
  it('pm.execution.iteration returns the iteration index', async () => {
    const result = await executeScript(
      'pm.variables.set("iter", String(pm.execution.iteration));',
      baseCtx({ iteration: 3 })
    )
    expect(result.mutations.local.iter).toBe('3')
  })
})
