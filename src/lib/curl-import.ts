export interface ParsedCurl {
  method: string
  url: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  body: { type: 'none' | 'json' | 'raw'; content: string }
  auth: { type: 'none' | 'basic'; username?: string; password?: string }
}

export function parseCurl(input: string): ParsedCurl {
  // Normalize: join backslash-continued lines, collapse whitespace
  const raw = input
    .replace(/\\\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw.startsWith('curl')) throw new Error('Not a valid cURL command')

  // Tokenize respecting single/double quotes
  const tokens = tokenize(raw)
  let i = 1 // skip 'curl'

  let method = ''
  let url = ''
  const headers: Array<{ key: string; value: string; enabled: boolean }> = []
  let bodyContent = ''
  let username = ''
  let password = ''

  while (i < tokens.length) {
    const tok = tokens[i]!

    if (tok === '-X' || tok === '--request') {
      method = tokens[++i] ?? 'GET'
    } else if (tok === '-H' || tok === '--header') {
      const header = tokens[++i] ?? ''
      const colonIdx = header.indexOf(':')
      if (colonIdx > 0) {
        headers.push({
          key: header.slice(0, colonIdx).trim(),
          value: header.slice(colonIdx + 1).trim(),
          enabled: true,
        })
      }
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      bodyContent = tokens[++i] ?? ''
    } else if (tok === '-u' || tok === '--user') {
      const creds = tokens[++i] ?? ''
      const colon = creds.indexOf(':')
      if (colon >= 0) {
        username = creds.slice(0, colon)
        password = creds.slice(colon + 1)
      } else {
        username = creds
      }
    } else if (!tok.startsWith('-') && !url) {
      url = tok
    }

    i++
  }

  // Infer method from body presence
  if (!method) method = bodyContent ? 'POST' : 'GET'

  // Infer content type from headers
  const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type')
  const contentType = contentTypeHeader?.value ?? ''
  let bodyType: 'none' | 'json' | 'raw' = 'none'
  if (bodyContent) {
    bodyType = contentType.includes('json') ? 'json' : 'raw'
  }

  return {
    method: method.toUpperCase(),
    url,
    headers: headers.filter(h => h.key.toLowerCase() !== 'content-type' || bodyType !== 'none'
      ? true : h.key.toLowerCase() !== 'content-type'),
    body: { type: bodyType, content: bodyContent },
    auth: username
      ? { type: 'basic', username, password }
      : { type: 'none' },
  }
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < input.length) {
    // Skip whitespace
    while (i < input.length && /\s/.test(input[i]!)) i++
    if (i >= input.length) break

    const ch = input[i]!
    if (ch === "'" || ch === '"') {
      // Quoted string
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
      // Unquoted token (stop at whitespace)
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
