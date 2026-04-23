/**
 * OpenAPI 3.0 / Swagger 2.0 importer.
 * Converts paths + operations into a flat ParsedCollection grouped by tags (→ folders).
 */

import type { ParsedCollection, ParsedFolder, ParsedRequest } from './postman-import'

export interface ImportResult {
  collection?: ParsedCollection
  error?: string
}

let _counter = 0
function tempId() { return `__oa_${++_counter}` }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseOAS3(doc: Record<string, any>): ImportResult {
  const title = doc.info?.title ?? 'Imported API'
  const servers = doc.servers as Array<{ url: string }> | undefined
  const baseUrl = servers?.[0]?.url ?? ''

  const folders: ParsedFolder[] = []
  const requests: ParsedRequest[] = []
  const tagMap = new Map<string, string>() // tag name → tempId

  function getFolderForTag(tag: string): string {
    if (!tagMap.has(tag)) {
      const id = tempId()
      folders.push({ tempId: id, name: tag })
      tagMap.set(tag, id)
    }
    return tagMap.get(tag)!
  }

  const paths = doc.paths as Record<string, Record<string, any>> | undefined
  if (!paths) return { error: 'No paths defined in OpenAPI document' }

  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue

      const name = op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`
      const tag = op.tags?.[0]
      const folderTempId = tag ? getFolderForTag(tag) : undefined

      const params: ParsedRequest['params'] = []
      const headers: ParsedRequest['headers'] = []

      for (const param of op.parameters ?? []) {
        if (param.in === 'query') {
          params.push({ key: param.name, value: param.example ?? '', enabled: true })
        } else if (param.in === 'header') {
          headers.push({ key: param.name, value: param.example ?? '', enabled: true })
        }
      }

      // Build URL: baseUrl + path (with {param} → {{param}})
      const url = (baseUrl + path).replace(/\{(\w+)\}/g, '{{$1}}')

      let body: ParsedRequest['body'] | undefined
      const reqBody = op.requestBody
      if (reqBody?.content?.['application/json']) {
        const schema = reqBody.content['application/json'].schema
        let content = ''
        if (schema?.example) content = JSON.stringify(schema.example, null, 2)
        else if (schema?.type === 'object') content = '{}'
        body = { type: 'json', content, rawType: 'json' }
      } else if (reqBody?.content?.['application/x-www-form-urlencoded']) {
        body = { type: 'x-www-form-urlencoded', content: '' }
      }

      requests.push({ name, method: method.toUpperCase(), url, params, headers, body, folderTempId })
    }
  }

  return { collection: { name: title, variables: [], folders, requests } }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSwagger2(doc: Record<string, any>): ImportResult {
  const title = doc.info?.title ?? 'Imported API'
  const host = doc.host ?? ''
  const basePath = doc.basePath ?? ''
  const scheme = doc.schemes?.[0] ?? 'https'
  const baseUrl = host ? `${scheme}://${host}${basePath}` : basePath

  const folders: ParsedFolder[] = []
  const requests: ParsedRequest[] = []
  const tagMap = new Map<string, string>()
  _counter = 0

  function getFolderForTag(tag: string): string {
    if (!tagMap.has(tag)) {
      const id = tempId()
      folders.push({ tempId: id, name: tag })
      tagMap.set(tag, id)
    }
    return tagMap.get(tag)!
  }

  const paths = doc.paths as Record<string, Record<string, any>> | undefined
  if (!paths) return { error: 'No paths defined' }

  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!op) continue

      const name = op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`
      const tag = op.tags?.[0]
      const folderTempId = tag ? getFolderForTag(tag) : undefined

      const params: ParsedRequest['params'] = []
      const headers: ParsedRequest['headers'] = []

      for (const param of op.parameters ?? []) {
        if (param.in === 'query') {
          params.push({ key: param.name, value: '', enabled: true })
        } else if (param.in === 'header') {
          headers.push({ key: param.name, value: '', enabled: true })
        }
      }

      const url = (baseUrl + path).replace(/\{(\w+)\}/g, '{{$1}}')

      const bodyParam = (op.parameters ?? []).find((p: any) => p.in === 'body')
      let body: ParsedRequest['body'] | undefined
      if (bodyParam) {
        body = { type: 'json', content: '{}', rawType: 'json' }
      }

      requests.push({ name, method: method.toUpperCase(), url, params, headers, body, folderTempId })
    }
  }

  return { collection: { name: title, variables: [], folders, requests } }
}

export function parseOpenApiDocument(content: string): ImportResult {
  let doc: Record<string, unknown>
  try {
    doc = JSON.parse(content) as Record<string, unknown>
  } catch {
    return { error: 'Invalid JSON. YAML OpenAPI files are not supported yet.' }
  }

  if (typeof doc !== 'object' || doc === null) return { error: 'Not a JSON object' }

  _counter = 0
  if (doc.openapi && String(doc.openapi).startsWith('3.')) {
    return parseOAS3(doc as Record<string, any>)
  }
  if (doc.swagger && String(doc.swagger).startsWith('2.')) {
    return parseSwagger2(doc as Record<string, any>)
  }

  return { error: 'Not a recognized OpenAPI (3.x) or Swagger (2.0) document' }
}
