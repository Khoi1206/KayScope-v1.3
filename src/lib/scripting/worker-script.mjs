// Piscina worker — runs user scripts in an isolated worker thread.
// Plain JS (no TypeScript, no Next.js imports) so it loads cleanly as a Worker.

function makeVarScope(source, mutationsTarget) {
  return {
    get: (key) => source[key] ?? mutationsTarget[key],
    set: (key, value) => { mutationsTarget[key] = String(value) },
    unset: (key) => { delete mutationsTarget[key] },
    has: (key) => key in source || key in mutationsTarget,
    toObject: () => ({ ...source, ...mutationsTarget }),
  }
}

function buildPmApi(ctx, tests, logs) {
  const mutations = { local: {}, environment: {}, collection: {}, global: {} }

  const serialize = (a) => {
    if (typeof a === 'string') return a
    if (a === undefined) return 'undefined'
    if (a === null) return 'null'
    return JSON.stringify(a)
  }

  const consoleApi = {
    log: (...args) => { logs.push(args.map(serialize).join(' ')) },
    warn: (...args) => { logs.push('[warn] ' + args.map(serialize).join(' ')) },
    error: (...args) => { logs.push('[error] ' + args.map(serialize).join(' ')) },
  }

  const makeExpect = (value) => ({
    to: {
      equal: (expected) => {
        if (value !== expected)
          throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`)
      },
      eql: (expected) => {
        if (JSON.stringify(value) !== JSON.stringify(expected))
          throw new Error(`Expected ${JSON.stringify(value)} to deep equal ${JSON.stringify(expected)}`)
      },
      be: {
        ok: () => { if (!value) throw new Error(`Expected ${JSON.stringify(value)} to be truthy`) },
        true: () => { if (value !== true) throw new Error(`Expected true, got ${JSON.stringify(value)}`) },
        false: () => { if (value !== false) throw new Error(`Expected false, got ${JSON.stringify(value)}`) },
        null: () => { if (value !== null) throw new Error(`Expected null, got ${JSON.stringify(value)}`) },
        undefined: () => { if (value !== undefined) throw new Error(`Expected undefined, got ${JSON.stringify(value)}`) },
        a: (type) => { if (typeof value !== type) throw new Error(`Expected type ${type}, got ${typeof value}`) },
        above: (n) => {
          if (typeof value !== 'number' || value <= n)
            throw new Error(`Expected ${value} to be above ${n}`)
        },
        below: (n) => {
          if (typeof value !== 'number' || value >= n)
            throw new Error(`Expected ${value} to be below ${n}`)
        },
      },
      include: (expected) => {
        if (typeof value === 'string' && typeof expected === 'string') {
          if (!value.includes(expected))
            throw new Error(`Expected "${value}" to include "${expected}"`)
        } else if (Array.isArray(value)) {
          if (!value.includes(expected))
            throw new Error(`Expected array to include ${JSON.stringify(expected)}`)
        }
      },
      have: {
        status: (status) => {
          const actual = value?.status
          if (actual !== status)
            throw new Error(`Expected status ${status}, got ${actual}`)
        },
      },
    },
  })

  const allScopes = () => ({
    ...ctx.global,
    ...mutations.global,
    ...ctx.collection,
    ...mutations.collection,
    ...ctx.environment,
    ...mutations.environment,
    ...ctx.local,
    ...mutations.local,
  })

  const varScope = makeVarScope(ctx.local, mutations.local)
  varScope.replaceIn = (str) => String(str).replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const all = allScopes()
    return key in all ? all[key] : `{{${key}}}`
  })

  const iterData = ctx.iterationData ?? {}
  const pmApi = {
    variables: varScope,
    environment: makeVarScope(ctx.environment, mutations.environment),
    collectionVariables: makeVarScope(ctx.collection, mutations.collection),
    globals: makeVarScope(ctx.global, mutations.global),

    iterationData: {
      get: (key) => iterData[key] ?? undefined,
      has: (key) => key in iterData,
      toObject: () => ({ ...iterData }),
    },

    execution: {
      iteration: ctx.iteration ?? 0,
    },

    request: ctx.request ?? null,

    test: (name, fn) => {
      try {
        fn()
        tests.push({ name, passed: true })
      } catch (err) {
        tests.push({ name, passed: false, error: err instanceof Error ? err.message : String(err) })
      }
    },

    expect: makeExpect,
    response: null,
    _mutations: mutations,
  }

  return { pmApi, consoleApi }
}

export default async function executeInWorker({ script, ctx, responseForPostScript }) {
  const tests = []
  const logs = []
  const { pmApi, consoleApi } = buildPmApi(ctx, tests, logs)

  if (responseForPostScript) {
    let parsedBody = responseForPostScript.body
    try { parsedBody = JSON.parse(responseForPostScript.body) } catch { /* leave as string */ }

    pmApi.response = {
      status: responseForPostScript.status,
      statusText: responseForPostScript.statusText,
      code: responseForPostScript.status,
      body: responseForPostScript.body,
      responseTime: responseForPostScript.durationMs,
      headers: {
        get: (key) => responseForPostScript.headers[key.toLowerCase()],
        has: (key) => key.toLowerCase() in responseForPostScript.headers,
        toObject: () => ({ ...responseForPostScript.headers }),
      },
      json: () => parsedBody,
      text: () => responseForPostScript.body,
      to: {
        have: {
          status: (status) => {
            if (responseForPostScript.status !== status)
              throw new Error(`Expected status ${status}, got ${responseForPostScript.status}`)
          },
        },
      },
    }
  }

  let error

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'pm', 'console', 'process', 'require', 'global', 'globalThis', 'Buffer', 'eval',
      `return (async () => { ${script} })()`
    )
    await fn(pmApi, consoleApi, undefined, undefined, undefined, undefined, undefined, undefined)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  return {
    mutations: pmApi._mutations,
    tests,
    logs,
    error,
  }
}
