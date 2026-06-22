import type { KVPair, RequestBody, RequestAuth } from '@/store/request.store'

export type SnippetLanguage = 'curl' | 'fetch' | 'axios' | 'python'

export interface SnippetInput {
  method: string
  url: string
  params?: KVPair[]
  headers?: KVPair[]
  body?: RequestBody
  auth?: RequestAuth
}

function activeKV(pairs: KVPair[] | undefined): KVPair[] {
  return (pairs ?? []).filter(p => p.enabled && p.key)
}

function buildUrl(url: string, params: KVPair[]): string {
  const active = activeKV(params)
  if (!active.length) return url
  const qs = active.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

function authHeaders(auth: RequestAuth | undefined): Record<string, string> {
  if (!auth || auth.type === 'none') return {}
  if (auth.type === 'bearer') return { Authorization: `Bearer ${auth.token ?? ''}` }
  if (auth.type === 'basic') {
    const b64 = btoa(`${auth.username ?? ''}:${auth.password ?? ''}`)
    return { Authorization: `Basic ${b64}` }
  }
  if (auth.type === 'api-key') return { [auth.apiKeyHeader ?? 'X-API-Key']: auth.apiKey ?? '' }
  return {}
}

function effectiveBodyType(body: RequestBody): string {
  if (body.type === 'raw' || body.type === 'json') return body.rawType ?? 'text'
  return body.type
}

// ── curl ─────────────────────────────────────────────────────────────────────

export function generateCurl(input: SnippetInput): string {
  const { method, url, params, headers, body, auth } = input
  const fullUrl = buildUrl(url, params ?? [])
  const hdrs = { ...authHeaders(auth) }
  const lines: string[] = [`curl -X ${method.toUpperCase()} '${fullUrl}'`]

  for (const h of activeKV(headers)) hdrs[h.key] = h.value

  let bodyStr = ''
  if (body && body.type !== 'none') {
    const btype = effectiveBodyType(body)
    if (body.type === 'raw' || body.type === 'json') {
      hdrs['Content-Type'] = btype === 'json' ? 'application/json' : `text/${btype}`
      bodyStr = body.content
    } else if (body.type === 'x-www-form-urlencoded') {
      hdrs['Content-Type'] = 'application/x-www-form-urlencoded'
      bodyStr = activeKV(body.formData).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    } else if (body.type === 'form-data') {
      for (const p of activeKV(body.formData)) {
        lines.push(`  -F '${p.key}=${p.value}'`)
      }
    }
  }

  for (const [k, v] of Object.entries(hdrs)) lines.push(`  -H '${k}: ${v}'`)
  if (bodyStr) lines.push(`  -d '${bodyStr.replace(/'/g, "\\'")}'`)

  return lines.join(' \\\n')
}

// ── fetch ─────────────────────────────────────────────────────────────────────

export function generateFetch(input: SnippetInput): string {
  const { method, url, params, headers, body, auth } = input
  const fullUrl = buildUrl(url, params ?? [])
  const hdrs: Record<string, string> = { ...authHeaders(auth) }
  for (const h of activeKV(headers)) hdrs[h.key] = h.value

  const lines: string[] = []
  let bodyExpr = ''

  if (body && body.type !== 'none') {
    const btype = effectiveBodyType(body)
    if (body.type === 'raw' || body.type === 'json') {
      hdrs['Content-Type'] = btype === 'json' ? 'application/json' : `text/${btype}`
      if (btype === 'json') {
        try {
          const parsed = JSON.parse(body.content)
          lines.push(`const body = ${JSON.stringify(parsed, null, 2)}`)
          bodyExpr = 'JSON.stringify(body)'
        } catch {
          bodyExpr = JSON.stringify(body.content)
        }
      } else {
        bodyExpr = JSON.stringify(body.content)
      }
    } else if (body.type === 'x-www-form-urlencoded') {
      hdrs['Content-Type'] = 'application/x-www-form-urlencoded'
      const pairs = activeKV(body.formData).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
      bodyExpr = JSON.stringify(pairs)
    }
  }

  if (lines.length) lines.push('')

  const opts: string[] = [`  method: '${method.toUpperCase()}'`]
  if (Object.keys(hdrs).length) {
    opts.push(`  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, '\n  ')}`)
  }
  if (bodyExpr) opts.push(`  body: ${bodyExpr}`)

  lines.push(`const response = await fetch('${fullUrl}', {`)
  lines.push(opts.join(',\n'))
  lines.push(`})`)
  lines.push(`const data = await response.json()`)
  lines.push(`console.log(data)`)
  return lines.join('\n')
}

// ── axios ─────────────────────────────────────────────────────────────────────

export function generateAxios(input: SnippetInput): string {
  const { method, url, params, headers, body, auth } = input
  const hdrs: Record<string, string> = { ...authHeaders(auth) }
  for (const h of activeKV(headers)) hdrs[h.key] = h.value

  const lines: string[] = [`import axios from 'axios'`, ``]
  const config: string[] = []
  let dataExpr = ''

  if (body && body.type !== 'none') {
    const btype = effectiveBodyType(body)
    if (body.type === 'raw' || body.type === 'json') {
      if (btype === 'json') {
        try {
          const parsed = JSON.parse(body.content)
          lines.push(`const data = ${JSON.stringify(parsed, null, 2)}`)
          lines.push(``)
          dataExpr = 'data'
        } catch {
          dataExpr = JSON.stringify(body.content)
        }
      } else {
        hdrs['Content-Type'] = `text/${btype}`
        dataExpr = JSON.stringify(body.content)
      }
    } else if (body.type === 'x-www-form-urlencoded') {
      hdrs['Content-Type'] = 'application/x-www-form-urlencoded'
      const pairs = activeKV(body.formData).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
      dataExpr = JSON.stringify(pairs)
    }
  }

  const activeParams = activeKV(params)
  if (activeParams.length) {
    const pObj = Object.fromEntries(activeParams.map(p => [p.key, p.value]))
    config.push(`  params: ${JSON.stringify(pObj, null, 4).replace(/\n/g, '\n  ')}`)
  }
  if (Object.keys(hdrs).length) {
    config.push(`  headers: ${JSON.stringify(hdrs, null, 4).replace(/\n/g, '\n  ')}`)
  }
  if (dataExpr) config.push(`  data: ${dataExpr}`)

  lines.push(`const response = await axios({`)
  lines.push(`  method: '${method.toUpperCase()}',`)
  lines.push(`  url: '${url}',`)
  if (config.length) lines.push(config.join(',\n'))
  lines.push(`})`)
  lines.push(`console.log(response.data)`)
  return lines.join('\n')
}

// ── python (requests) ─────────────────────────────────────────────────────────

export function generatePython(input: SnippetInput): string {
  const { method, url, params, headers, body, auth } = input
  const hdrs: Record<string, string> = { ...authHeaders(auth) }
  for (const h of activeKV(headers)) hdrs[h.key] = h.value

  const lines: string[] = [`import requests`, ``]
  const kwargs: string[] = []

  const activeParams = activeKV(params)
  if (activeParams.length) {
    const pObj = Object.fromEntries(activeParams.map(p => [p.key, p.value]))
    lines.push(`params = ${pyDict(pObj)}`)
    kwargs.push('params=params')
  }

  if (Object.keys(hdrs).length) {
    lines.push(`headers = ${pyDict(hdrs)}`)
    kwargs.push('headers=headers')
  }

  if (body && body.type !== 'none') {
    const btype = effectiveBodyType(body)
    if (body.type === 'raw' || body.type === 'json') {
      if (btype === 'json') {
        try {
          const parsed = JSON.parse(body.content)
          lines.push(`json_data = ${pyDict(parsed)}`)
          kwargs.push('json=json_data')
        } catch {
          lines.push(`data = ${JSON.stringify(body.content)}`)
          kwargs.push('data=data')
        }
      } else {
        lines.push(`data = ${JSON.stringify(body.content)}`)
        kwargs.push('data=data')
      }
    } else if (body.type === 'x-www-form-urlencoded') {
      const pObj = Object.fromEntries(activeKV(body.formData).map(p => [p.key, p.value]))
      lines.push(`data = ${pyDict(pObj)}`)
      kwargs.push('data=data')
    } else if (body.type === 'form-data') {
      const pObj = Object.fromEntries(activeKV(body.formData).map(p => [p.key, p.value]))
      lines.push(`files = ${pyDict(pObj)}`)
      kwargs.push('files=files')
    }
  }

  if (lines[lines.length - 1] !== '') lines.push('')
  const kwStr = kwargs.length ? ', ' + kwargs.join(', ') : ''
  lines.push(`response = requests.${method.toLowerCase()}('${url}'${kwStr})`)
  lines.push(`print(response.json())`)
  return lines.join('\n')
}

function pyDict(obj: unknown, indent = 0): string {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj)
  const pad = '    '.repeat(indent + 1)
  const closePad = '    '.repeat(indent)
  const entries = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => `${pad}${JSON.stringify(k)}: ${pyDict(v, indent + 1)}`)
  return `{\n${entries.join(',\n')}\n${closePad}}`
}

export function generateSnippet(lang: SnippetLanguage, input: SnippetInput): string {
  switch (lang) {
    case 'curl': return generateCurl(input)
    case 'fetch': return generateFetch(input)
    case 'axios': return generateAxios(input)
    case 'python': return generatePython(input)
  }
}
