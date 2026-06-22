import { describe, it, expect } from 'vitest'
import { generateCurl, generateFetch, generateAxios, generatePython, generateSnippet } from '@/lib/snippet-generator'
import type { SnippetInput } from '@/lib/snippet-generator'

const basic: SnippetInput = {
  method: 'GET',
  url: 'https://api.example.com/users',
}

const withAuth: SnippetInput = {
  method: 'POST',
  url: 'https://api.example.com/data',
  headers: [{ key: 'X-Custom', value: 'myval', enabled: true }],
  body: { type: 'raw', rawType: 'json', content: '{"name":"test"}' },
  auth: { type: 'bearer', token: 'tok123' },
}

const withParams: SnippetInput = {
  method: 'GET',
  url: 'https://api.example.com/search',
  params: [
    { key: 'q', value: 'hello world', enabled: true },
    { key: 'page', value: '2', enabled: true },
    { key: 'disabled', value: 'x', enabled: false },
  ],
}

describe('snippet-generator — curl', () => {
  it('generates basic GET curl', () => {
    const out = generateCurl(basic)
    expect(out).toContain("curl -X GET 'https://api.example.com/users'")
  })

  it('includes bearer auth header', () => {
    const out = generateCurl(withAuth)
    expect(out).toContain("Authorization: Bearer tok123")
  })

  it('includes JSON body and content-type', () => {
    const out = generateCurl(withAuth)
    expect(out).toContain('Content-Type: application/json')
    expect(out).toContain('-d')
  })

  it('includes custom header', () => {
    const out = generateCurl(withAuth)
    expect(out).toContain('X-Custom: myval')
  })

  it('appends enabled params to URL', () => {
    const out = generateCurl(withParams)
    expect(out).toContain('q=hello%20world')
    expect(out).toContain('page=2')
    expect(out).not.toContain('disabled')
  })

  it('generates form-data with -F flags', () => {
    const input: SnippetInput = {
      method: 'POST',
      url: 'https://api.example.com/upload',
      body: { type: 'form-data', content: '', formData: [{ key: 'file', value: 'data.csv', enabled: true }] },
    }
    const out = generateCurl(input)
    expect(out).toContain("-F 'file=data.csv'")
  })
})

describe('snippet-generator — fetch', () => {
  it('generates basic fetch call', () => {
    const out = generateFetch(basic)
    expect(out).toContain("fetch('https://api.example.com/users'")
    expect(out).toContain("method: 'GET'")
  })

  it('includes Authorization header for bearer', () => {
    const out = generateFetch(withAuth)
    expect(out).toContain('Authorization')
    expect(out).toContain('Bearer tok123')
  })

  it('serialises JSON body', () => {
    const out = generateFetch(withAuth)
    expect(out).toContain('JSON.stringify(body)')
  })

  it('appends params into URL for GET', () => {
    const out = generateFetch(withParams)
    expect(out).toContain('q=hello%20world')
  })
})

describe('snippet-generator — axios', () => {
  it('contains axios import', () => {
    const out = generateAxios(basic)
    expect(out).toContain("import axios from 'axios'")
  })

  it('sets method and url', () => {
    const out = generateAxios(basic)
    expect(out).toContain("method: 'GET'")
    expect(out).toContain("url: 'https://api.example.com/users'")
  })

  it('includes params object', () => {
    const out = generateAxios(withParams)
    expect(out).toContain('params:')
    expect(out).toContain('"q"')
  })
})

describe('snippet-generator — python', () => {
  it('contains requests import', () => {
    const out = generatePython(basic)
    expect(out).toContain('import requests')
  })

  it('uses correct method name', () => {
    const out = generatePython(basic)
    expect(out).toContain('requests.get(')
  })

  it('includes headers dict', () => {
    const out = generatePython(withAuth)
    expect(out).toContain('headers =')
    expect(out).toContain('Authorization')
  })

  it('includes json_data for JSON body', () => {
    const out = generatePython(withAuth)
    expect(out).toContain('json_data =')
    expect(out).toContain('json=json_data')
  })
})

describe('snippet-generator — generateSnippet dispatch', () => {
  it.each(['curl', 'fetch', 'axios', 'python'] as const)('dispatches %s correctly', (lang) => {
    const out = generateSnippet(lang, basic)
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('snippet-generator — basic auth', () => {
  it('generates Basic Authorization header', () => {
    const input: SnippetInput = {
      method: 'GET',
      url: 'https://api.example.com',
      auth: { type: 'basic', username: 'user', password: 'pass' },
    }
    const out = generateCurl(input)
    expect(out).toContain('Authorization: Basic')
  })
})

describe('snippet-generator — api-key auth', () => {
  it('generates custom API key header', () => {
    const input: SnippetInput = {
      method: 'GET',
      url: 'https://api.example.com',
      auth: { type: 'api-key', apiKey: 'secret', apiKeyHeader: 'X-Api-Key' },
    }
    const out = generateCurl(input)
    expect(out).toContain('X-Api-Key: secret')
  })
})

describe('snippet-generator — disabled params/headers excluded', () => {
  it('skips disabled KV pairs', () => {
    const input: SnippetInput = {
      method: 'GET',
      url: 'https://example.com',
      headers: [
        { key: 'Active', value: 'yes', enabled: true },
        { key: 'Skipped', value: 'no', enabled: false },
      ],
    }
    const out = generateCurl(input)
    expect(out).toContain('Active: yes')
    expect(out).not.toContain('Skipped')
  })
})
