/**
 * Postman Collection v2.1 importer.
 * ParsedRequest fields mirror the KayScope API schema directly
 * (reqBodySchema / reqAuthSchema) so they can be sent to /api/requests as-is.
 */

export interface ParsedFolder {
  tempId: string
  name: string
  parentTempId?: string
}

export interface ParsedRequest {
  name: string
  method: string
  url: string
  headers: { key: string; value: string; enabled: boolean }[]
  params: { key: string; value: string; enabled: boolean }[]
  body?: {
    type: 'none' | 'json' | 'raw' | 'form-data' | 'x-www-form-urlencoded'
    content?: string
    formData?: { key: string; value: string; enabled: boolean }[]
    rawType?: 'text' | 'json' | 'javascript' | 'html' | 'xml'
  }
  auth?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key'
    token?: string
    username?: string
    password?: string
    apiKey?: string
    apiKeyHeader?: string
  }
  folderTempId?: string
  preRequestScript?: string
  postRequestScript?: string
}

export interface ParsedCollection {
  name: string
  variables: { key: string; value: string; enabled: boolean; secret: boolean }[]
  folders: ParsedFolder[]
  requests: ParsedRequest[]
}

export interface ImportResult {
  collection?: ParsedCollection
  error?: string
}

let _tempIdCounter = 0
function tempId() { return `__tmp_${++_tempIdCounter}` }

// Most Postman v2.1 exporters emit auth.bearer/basic/apikey as an array of
// {key, value} pairs, but some tools (e.g. Bruno's Postman-compatible export)
// collapse it to a single {key, value} object instead — normalize both shapes
// to an array so the .find() lookups below work either way.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toKvArray(v: any): any[] {
  if (Array.isArray(v)) return v
  return v && typeof v === 'object' ? [v] : []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAuth(auth: any): ParsedRequest['auth'] | undefined {
  if (!auth || auth.type === 'noauth') return { type: 'none' }
  if (auth.type === 'bearer') {
    const token = toKvArray(auth.bearer).find((b: any) => b.key === 'token')?.value ?? ''
    return { type: 'bearer', token }
  }
  if (auth.type === 'basic') {
    const basic = toKvArray(auth.basic)
    const username = basic.find((b: any) => b.key === 'username')?.value ?? ''
    const password = basic.find((b: any) => b.key === 'password')?.value ?? ''
    return { type: 'basic', username, password }
  }
  if (auth.type === 'apikey') {
    const apikey = toKvArray(auth.apikey)
    const apiKey = apikey.find((b: any) => b.key === 'value')?.value ?? ''
    const apiKeyHeader = apikey.find((b: any) => b.key === 'key')?.value ?? 'X-API-Key'
    return { type: 'api-key', apiKey, apiKeyHeader }
  }
  return undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBody(body: any): ParsedRequest['body'] | undefined {
  if (!body || body.mode === 'none') return { type: 'none' }

  if (body.mode === 'raw') {
    const lang: string = body.options?.raw?.language ?? 'text'
    const rawTypeMap: Record<string, 'text' | 'json' | 'javascript' | 'html' | 'xml'> = {
      json: 'json', javascript: 'javascript', html: 'html', xml: 'xml',
    }
    return {
      type: 'raw',
      content: body.raw ?? '',
      rawType: rawTypeMap[lang] ?? 'text',
    }
  }

  if (body.mode === 'urlencoded') {
    const formData = (body.urlencoded ?? [])
      .filter((p: any) => p.type !== 'file')
      .map((p: any) => ({
        key: p.key ?? '',
        value: p.value ?? '',
        enabled: !p.disabled,
      }))
    return { type: 'x-www-form-urlencoded', formData }
  }

  if (body.mode === 'formdata') {
    const formData = (body.formdata ?? [])
      .filter((p: any) => p.type !== 'file') // skip file fields — not supported
      .map((p: any) => ({
        key: p.key ?? '',
        value: p.value ?? '',
        enabled: !p.disabled,
      }))
    return { type: 'form-data', formData }
  }

  return { type: 'raw', content: body.raw ?? '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseUrl(url: any): { url: string; params: ParsedRequest['params'] } {
  if (!url) return { url: '', params: [] }
  const rawUrl = typeof url === 'string' ? url : (url.raw ?? '')
  const params: ParsedRequest['params'] = []
  if (url.query && Array.isArray(url.query)) {
    for (const q of url.query) {
      params.push({
        key: q.key ?? '',
        value: q.value ?? '',
        enabled: !q.disabled,
      })
    }
  }
  // Strip query string from raw URL — params are stored separately
  const cleanUrl = params.length > 0 ? rawUrl.split('?')[0] : rawUrl
  return { url: cleanUrl, params }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractScript(events: any[], listen: string): string | undefined {
  if (!Array.isArray(events)) return undefined
  const ev = events.find((e: any) => e.listen === listen)
  if (!ev?.script?.exec) return undefined
  return Array.isArray(ev.script.exec) ? ev.script.exec.join('\n') : ev.script.exec
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walkItems(
  items: any[],
  folders: ParsedFolder[],
  requests: ParsedRequest[],
  parentTempId?: string
) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const id = tempId()
      folders.push({ tempId: id, name: item.name ?? 'Folder', parentTempId })
      walkItems(item.item, folders, requests, id)
    } else if (item.request) {
      const req = item.request
      const { url, params } = parseUrl(req.url)
      const headers: ParsedRequest['headers'] = (req.header ?? [])
        .filter((h: any) => !h.disabled)
        .map((h: any) => ({ key: h.key ?? '', value: h.value ?? '', enabled: true }))
      const preScript = extractScript(item.event, 'prerequest')
      const postScript = extractScript(item.event, 'test')

      requests.push({
        name: item.name ?? 'Request',
        method: (req.method ?? 'GET').toUpperCase(),
        url,
        params,
        headers,
        body: parseBody(req.body),
        auth: parseAuth(req.auth),
        folderTempId: parentTempId,
        preRequestScript: preScript,
        postRequestScript: postScript,
      })
    }
  }
}

export function parsePostmanCollection(content: string): ImportResult {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    return { error: 'Invalid JSON' }
  }

  if (typeof raw !== 'object' || raw === null) return { error: 'Not a JSON object' }
  const col = raw as Record<string, unknown>

  if (!col.info || !Array.isArray(col.item)) {
    return { error: 'Not a valid Postman Collection (missing info or item array)' }
  }

  const info = col.info as Record<string, unknown>
  const name = (info.name as string) ?? 'Imported Collection'

  const rawVars = Array.isArray(col.variable) ? col.variable as Array<Record<string, string>> : []
  const variables = rawVars
    .filter(v => v.key)
    .map(v => ({
      key: v.key,
      value: v.value ?? '',
      enabled: true,
      secret: false,
    }))

  const folders: ParsedFolder[] = []
  const requests: ParsedRequest[] = []
  _tempIdCounter = 0
  walkItems(col.item as unknown[], folders, requests)

  return { collection: { name, variables, folders, requests } }
}
