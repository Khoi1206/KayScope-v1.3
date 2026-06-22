export interface ParsedCurl {
  method: string
  url: string
  params: Array<{ key: string; value: string; enabled: boolean }>
  headers: Array<{ key: string; value: string; enabled: boolean }>
  body: {
    type: 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded'
    content: string
    rawType?: 'text' | 'json' | 'javascript' | 'html' | 'xml'
    formData?: Array<{ key: string; value: string; enabled: boolean }>
  }
  auth: {
    type: 'none' | 'bearer' | 'basic'
    token?: string
    username?: string
    password?: string
  }
}

export function parseCurl(input: string): ParsedCurl {
  // Normalize: join backslash-continued lines, collapse whitespace
  const raw = input
    .replace(/\\\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw.toLowerCase().startsWith('curl')) throw new Error('Not a valid cURL command')

  const tokens = tokenize(raw)
  let i = 1 // skip 'curl'

  let method = ''
  let rawUrl = ''
  const headers: Array<{ key: string; value: string; enabled: boolean }> = []
  const formData: Array<{ key: string; value: string; enabled: boolean }> = []
  let bodyContent = ''
  let username = ''
  let password = ''
  let bearerToken = ''
  let isFormData = false
  let isUrlEncoded = false

  while (i < tokens.length) {
    const tok = tokens[i]!

    if (tok === '-X' || tok === '--request') {
      method = tokens[++i] ?? 'GET'
    } else if (tok === '-H' || tok === '--header') {
      const header = tokens[++i] ?? ''
      const colonIdx = header.indexOf(':')
      if (colonIdx > 0) {
        const key = header.slice(0, colonIdx).trim()
        const value = header.slice(colonIdx + 1).trim()
        // Detect Authorization header
        if (key.toLowerCase() === 'authorization') {
          if (value.toLowerCase().startsWith('bearer ')) {
            bearerToken = value.slice(7).trim()
          } else {
            headers.push({ key, value, enabled: true })
          }
        } else {
          headers.push({ key, value, enabled: true })
        }
      }
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      bodyContent = tokens[++i] ?? ''
    } else if (tok === '--data-urlencode') {
      const raw = tokens[++i] ?? ''
      const eq = raw.indexOf('=')
      if (eq >= 0) {
        const k = raw.slice(0, eq)
        const v = decodeURIComponent(raw.slice(eq + 1))
        if (bodyContent) bodyContent += '&'
        bodyContent += `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
        isUrlEncoded = true
      }
    } else if (tok === '-F' || tok === '--form') {
      const pair = tokens[++i] ?? ''
      const eq = pair.indexOf('=')
      if (eq >= 0) {
        formData.push({ key: pair.slice(0, eq), value: pair.slice(eq + 1), enabled: true })
      }
      isFormData = true
    } else if (tok === '-u' || tok === '--user') {
      const creds = tokens[++i] ?? ''
      const colon = creds.indexOf(':')
      if (colon >= 0) {
        username = creds.slice(0, colon)
        password = creds.slice(colon + 1)
      } else {
        username = creds
      }
    } else if (tok === '--bearer') {
      bearerToken = tokens[++i] ?? ''
    } else if (!tok.startsWith('-') && !rawUrl) {
      rawUrl = tok
    }

    i++
  }

  // Parse URL: strip query string → params array
  let url = rawUrl
  const params: Array<{ key: string; value: string; enabled: boolean }> = []
  try {
    const parsed = new URL(rawUrl)
    parsed.searchParams.forEach((value, key) => {
      params.push({ key, value, enabled: true })
    })
    // Reconstruct URL without query string
    parsed.search = ''
    url = parsed.toString()
  } catch {
    // rawUrl might be a template with {{vars}}, not parseable — keep as-is
    const qIdx = rawUrl.indexOf('?')
    if (qIdx >= 0) {
      url = rawUrl.slice(0, qIdx)
      rawUrl.slice(qIdx + 1).split('&').forEach(pair => {
        const eq = pair.indexOf('=')
        if (eq >= 0) {
          params.push({ key: decodeURIComponent(pair.slice(0, eq)), value: decodeURIComponent(pair.slice(eq + 1)), enabled: true })
        } else if (pair) {
          params.push({ key: decodeURIComponent(pair), value: '', enabled: true })
        }
      })
    }
  }

  // Infer method
  if (!method) {
    if (isFormData || bodyContent) method = 'POST'
    else method = 'GET'
  }

  // Determine body type
  const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type')
  const contentType = contentTypeHeader?.value?.toLowerCase() ?? ''

  let body: ParsedCurl['body']
  if (isFormData) {
    body = { type: 'form-data', content: '', formData }
  } else if (isUrlEncoded || contentType.includes('x-www-form-urlencoded')) {
    body = { type: 'x-www-form-urlencoded', content: bodyContent }
  } else if (bodyContent) {
    const isJson = contentType.includes('json') || isJsonString(bodyContent)
    body = { type: 'raw', rawType: isJson ? 'json' : 'text', content: bodyContent }
  } else {
    body = { type: 'none', content: '' }
  }

  // Determine auth
  const auth: ParsedCurl['auth'] = bearerToken
    ? { type: 'bearer', token: bearerToken }
    : username
    ? { type: 'basic', username, password }
    : { type: 'none' }

  // Remove content-type header if we already captured the body type
  const finalHeaders = body.type !== 'none'
    ? headers.filter(h => h.key.toLowerCase() !== 'content-type')
    : headers

  return {
    method: method.toUpperCase(),
    url,
    params,
    headers: finalHeaders,
    body,
    auth,
  }
}

function isJsonString(s: string): boolean {
  const t = s.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i]!)) i++
    if (i >= input.length) break

    const ch = input[i]!
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let s = ''
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++
          s += input[i]
        } else {
          s += input[i]
        }
        i++
      }
      i++ // closing quote
      tokens.push(s)
    } else {
      let s = ''
      while (i < input.length && !/\s/.test(input[i]!)) {
        s += input[i]
        i++
      }
      tokens.push(s)
    }
  }
  return tokens
}
