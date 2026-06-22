import { describe, it, expect } from 'vitest'
import { emptyScopes, mergeScopes, toServerScopes, type ScopeSet } from '../scope'
import {
  resolveVar,
  interpolate,
  interpolateWithStatus,
  buildUrl,
  buildHeaders,
  extractVarNames,
  replaceIn,
} from '../engine'
import { createDynamicVarSnapshot } from '../dynamic-vars'

// postman-style-variable-parity

function scopesWith(overrides: Partial<ScopeSet>): ScopeSet {
  return mergeScopes(emptyScopes(), overrides)
}

describe('postman-style-variable-parity — scope priority', () => {
  it('resolves request > local > data > environment > collection > global', () => {
    const scopes = scopesWith({
      request: { v: 'request' },
      local: { v: 'local' },
      data: { v: 'data' },
      environment: { v: 'environment' },
      collection: { v: 'collection' },
      global: { v: 'global' },
    })
    expect(resolveVar('v', scopes)).toBe('request')
  })

  it('request beats local when request is absent for other keys', () => {
    const scopes = scopesWith({
      local: { v: 'local' },
      data: { v: 'data' },
      environment: { v: 'environment' },
    })
    expect(resolveVar('v', scopes)).toBe('local')
  })

  it('falls through to data when local is absent', () => {
    const scopes = scopesWith({ data: { v: 'data' }, environment: { v: 'environment' } })
    expect(resolveVar('v', scopes)).toBe('data')
  })

  it('falls through to environment when local/data are absent', () => {
    const scopes = scopesWith({ environment: { v: 'environment' }, collection: { v: 'collection' } })
    expect(resolveVar('v', scopes)).toBe('environment')
  })

  it('falls through to collection when environment is absent', () => {
    const scopes = scopesWith({ collection: { v: 'collection' }, global: { v: 'global' } })
    expect(resolveVar('v', scopes)).toBe('collection')
  })

  it('falls through to global as last resort', () => {
    const scopes = scopesWith({ global: { v: 'global' } })
    expect(resolveVar('v', scopes)).toBe('global')
  })

  it('returns undefined when variable is in no scope', () => {
    const scopes = emptyScopes()
    expect(resolveVar('missing', scopes)).toBeUndefined()
  })

  it('dynamic variables outrank every static scope', () => {
    const scopes = scopesWith({ request: { $guid: 'not-a-guid' } })
    const dynamicVars = { $guid: 'real-guid' }
    expect(resolveVar('$guid', scopes, dynamicVars)).toBe('real-guid')
  })
})

describe('postman-style-variable-parity — unresolved passthrough', () => {
  it('never silently becomes an empty string', () => {
    const scopes = emptyScopes()
    expect(interpolate('{{missing}}', scopes)).toBe('{{missing}}')
  })

  it('leaves unresolved tokens untouched inside larger strings', () => {
    const scopes = scopesWith({ global: { known: 'value' } })
    expect(interpolate('{{known}}/{{missing}}', scopes)).toBe('value/{{missing}}')
  })

  it('replaceIn leaves unknown tokens as-is', () => {
    expect(replaceIn('{{a}}-{{b}}', { a: '1' })).toBe('1-{{b}}')
  })
})

describe('postman-style-variable-parity — dynamic variable snapshot consistency', () => {
  it('resolves the same {{$guid}} value for repeated references within one snapshot', () => {
    const scopes = emptyScopes()
    const dynamicVars = createDynamicVarSnapshot()
    const result = interpolate('{{$guid}}|{{$guid}}', scopes, dynamicVars)
    const [a, b] = result.split('|')
    expect(a).toBe(b)
    expect(a).not.toBe('{{$guid}}')
  })

  it('produces a fresh value across two separate snapshots', () => {
    const scopes = emptyScopes()
    const snap1 = createDynamicVarSnapshot()
    const snap2 = createDynamicVarSnapshot()
    expect(snap1.$guid).not.toBe(snap2.$guid)
  })
})

describe('postman-style-variable-parity — toServerScopes()', () => {
  it('merges request into local with request winning', () => {
    const scopes = scopesWith({
      local: { v: 'local', onlyLocal: 'L' },
      request: { v: 'request', onlyRequest: 'R' },
      data: { d: '1' },
    })
    const server = toServerScopes(scopes)
    expect(server.local).toEqual({ v: 'request', onlyLocal: 'L', onlyRequest: 'R' })
    expect(server.data).toEqual({ d: '1' })
  })

  it('does not leak environment/collection/global scopes to the client payload shape', () => {
    const scopes = scopesWith({ environment: { e: '1' }, collection: { c: '1' }, global: { g: '1' } })
    const server = toServerScopes(scopes)
    expect(server).toEqual({ local: {}, data: {} })
  })
})

describe('postman-style-variable-parity — interpolateWithStatus()', () => {
  it('reports hasUnresolved=false and empty unresolvedVars when everything resolves', () => {
    const scopes = scopesWith({ global: { a: '1' } })
    const status = interpolateWithStatus('{{a}}', scopes)
    expect(status).toEqual({ result: '1', hasUnresolved: false, unresolvedVars: [] })
  })

  it('reports each unresolved variable name in order', () => {
    const scopes = scopesWith({ global: { a: '1' } })
    const status = interpolateWithStatus('{{a}}-{{b}}-{{c}}', scopes)
    expect(status.hasUnresolved).toBe(true)
    expect(status.unresolvedVars).toEqual(['b', 'c'])
    expect(status.result).toBe('1-{{b}}-{{c}}')
  })
})

describe('postman-style-variable-parity — buildUrl()', () => {
  it('interpolates the host and strips any inline query string', () => {
    const scopes = scopesWith({ global: { host: 'https://api.example.com' } })
    expect(buildUrl('{{host}}/users?id=1', scopes)).toBe('https://api.example.com/users')
  })

  it('throws on invalid URL after interpolation', () => {
    const scopes = emptyScopes()
    expect(() => buildUrl('{{missing}}/path', scopes)).toThrow(/Invalid URL/)
  })

  it('throws when the host itself fails to resolve', () => {
    const scopes = emptyScopes()
    expect(() => buildUrl('not a url at all', scopes)).toThrow()
  })
})

describe('postman-style-variable-parity — buildHeaders()', () => {
  it('interpolates both header key and value', () => {
    const scopes = scopesWith({ global: { headerName: 'X-Trace-Id', headerValue: 'abc123' } })
    const headers = buildHeaders(
      [{ key: '{{headerName}}', value: '{{headerValue}}', enabled: true }],
      scopes
    )
    expect(headers).toEqual({ 'X-Trace-Id': 'abc123' })
  })

  it('skips disabled headers', () => {
    const scopes = scopesWith({ global: { v: '1' } })
    const headers = buildHeaders(
      [
        { key: 'Enabled', value: '{{v}}', enabled: true },
        { key: 'Disabled', value: '{{v}}', enabled: false },
      ],
      scopes
    )
    expect(headers).toEqual({ Enabled: '1' })
  })

  it('drops headers whose key resolves to an empty string', () => {
    const scopes = emptyScopes()
    const headers = buildHeaders([{ key: '', value: 'x', enabled: true }], scopes)
    expect(headers).toEqual({})
  })
})

describe('postman-style-variable-parity — extractVarNames()', () => {
  it('extracts every distinct token reference in order, including duplicates', () => {
    expect(extractVarNames('{{a}}/{{b}}/{{a}}')).toEqual(['a', 'b', 'a'])
  })

  it('extracts dynamic variable names with the leading $', () => {
    expect(extractVarNames('{{$guid}}-{{$timestamp}}')).toEqual(['$guid', '$timestamp'])
  })

  it('returns an empty array when there are no tokens', () => {
    expect(extractVarNames('https://example.com/no-vars-here')).toEqual([])
  })
})
