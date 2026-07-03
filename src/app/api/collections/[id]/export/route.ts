import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findFoldersByCollection } from '@/db/queries/folders'
import { findRequestsByCollection } from '@/db/queries/requests'

type Folder = { id: string; name: string; parentFolderId?: string | null }
type Request = {
  id: string; name: string; folderId?: string | null
  method: string; url: string
  params?: Array<{ key: string; value: string; enabled: boolean }> | null
  headers?: Array<{ key: string; value: string; enabled: boolean }> | null
  body?: { type: string; content?: string; formData?: unknown[] } | null
  auth?: { type: string; token?: string; username?: string; password?: string; apiKey?: string; apiKeyHeader?: string } | null
  preRequestScript?: string | null
  postRequestScript?: string | null
}

function buildPostmanRequest(r: Request) {
  const params = (r.params ?? []).filter(p => p.enabled)
  const rawUrl = params.length > 0
    ? `${r.url}?${params.map(p => `${p.key}=${p.value}`).join('&')}`
    : r.url
  const urlObj: Record<string, unknown> = {
    raw: rawUrl,
    query: params.map(p => ({ key: p.key, value: p.value, disabled: false })),
  }

  const headers = (r.headers ?? []).filter(h => h.enabled).map(h => ({ key: h.key, value: h.value, disabled: false }))

  let authObj: Record<string, unknown> | undefined
  const auth = r.auth
  if (auth?.type === 'bearer') {
    authObj = { type: 'bearer', bearer: [{ key: 'token', value: auth.token ?? '', type: 'string' }] }
  } else if (auth?.type === 'basic') {
    authObj = { type: 'basic', basic: [{ key: 'username', value: auth.username ?? '', type: 'string' }, { key: 'password', value: auth.password ?? '', type: 'string' }] }
  } else if (auth?.type === 'api-key') {
    authObj = { type: 'apikey', apikey: [{ key: 'key', value: auth.apiKeyHeader ?? 'X-API-Key', type: 'string' }, { key: 'value', value: auth.apiKey ?? '', type: 'string' }] }
  }

  let bodyObj: Record<string, unknown> | undefined
  const body = r.body
  if (body?.type === 'json' || body?.type === 'raw') {
    bodyObj = { mode: 'raw', raw: body.content ?? '', options: { raw: { language: body.type === 'json' ? 'json' : 'text' } } }
  } else if (body?.type === 'x-www-form-urlencoded') {
    const pairs = (body.content ?? '').split('&').filter(Boolean).map(p => {
      const eq = p.indexOf('=')
      return { key: eq >= 0 ? decodeURIComponent(p.slice(0, eq)) : p, value: eq >= 0 ? decodeURIComponent(p.slice(eq + 1)) : '', disabled: false }
    })
    bodyObj = { mode: 'urlencoded', urlencoded: pairs }
  } else if (body?.type === 'form-data') {
    const fd = (body.formData ?? []) as Array<{ key: string; value: string; enabled: boolean }>
    bodyObj = { mode: 'formdata', formdata: fd.map(f => ({ key: f.key, value: f.value, disabled: !f.enabled })) }
  }

  const events: unknown[] = []
  if (r.preRequestScript?.trim()) {
    events.push({ listen: 'prerequest', script: { exec: r.preRequestScript.split('\n'), type: 'text/javascript' } })
  }
  if (r.postRequestScript?.trim()) {
    events.push({ listen: 'test', script: { exec: r.postRequestScript.split('\n'), type: 'text/javascript' } })
  }

  const request: Record<string, unknown> = { method: r.method, header: headers, url: urlObj }
  if (authObj) request.auth = authObj
  if (bodyObj) request.body = bodyObj

  const item: Record<string, unknown> = { name: r.name, request }
  if (events.length) item.event = events
  return item
}

function extractPath(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname || '/'
  } catch {
    // Template URL like {{baseUrl}}/users/{{id}} — strip the leading {{var}} host placeholder
    const idx = rawUrl.indexOf('}}')
    const rest = idx !== -1 ? rawUrl.slice(idx + 2) : rawUrl
    const noQuery = rest.split('?')[0] ?? rest
    return noQuery.startsWith('/') ? noQuery : `/${noQuery}`
  }
}

function buildOpenApiOperation(r: Request) {
  const pathParams = Array.from(new Set(Array.from(extractPath(r.url).matchAll(/\{(\w+)\}/g)).map(m => m[1])))
  const queryParams = (r.params ?? []).filter(p => p.enabled).map(p => ({
    name: p.key, in: 'query', required: false, schema: { type: 'string', example: p.value },
  }))
  const headerParams = (r.headers ?? []).filter(h => h.enabled).map(h => ({
    name: h.key, in: 'header', required: false, schema: { type: 'string', example: h.value },
  }))
  const pathParamObjs = pathParams.map(name => ({
    name, in: 'path', required: true, schema: { type: 'string' },
  }))

  const operation: Record<string, unknown> = {
    summary: r.name,
    parameters: [...pathParamObjs, ...queryParams, ...headerParams],
    responses: { '200': { description: 'OK' } },
  }

  const body = r.body
  if (body && body.type !== 'none' && body.content) {
    const mediaType = body.type === 'json' || body.type === 'raw' ? 'application/json' : 'application/x-www-form-urlencoded'
    operation.requestBody = {
      content: { [mediaType]: { schema: { type: 'string', example: body.content } } },
    }
  }

  return operation
}

function buildOpenApiSpec(collectionName: string, description: string, requests: Request[]) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const r of requests) {
    const rawPath = extractPath(r.url).replace(/\{\{(\w+)\}\}/g, '{$1}') || '/'
    const method = r.method.toLowerCase()
    paths[rawPath] ??= {}
    paths[rawPath]![method] = buildOpenApiOperation(r)
  }
  return {
    openapi: '3.0.3',
    info: { title: collectionName, description, version: '1.0.0' },
    paths,
  }
}

function buildPostmanFolder(folderId: string, folders: Folder[], requests: Request[]): Record<string, unknown> {
  const folder = folders.find(f => f.id === folderId)!
  const childFolders = folders.filter(f => f.parentFolderId === folderId)
  const childRequests = requests.filter(r => r.folderId === folderId)
  return {
    name: folder.name,
    item: [
      ...childRequests.map(buildPostmanRequest),
      ...childFolders.map(cf => buildPostmanFolder(cf.id, folders, requests)),
    ],
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await requireActiveWorkspace(req, session.user.id).catch(() => null)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const collection = await findCollectionByIdForWorkspace(params.id, workspace.id)
  if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const [folders, requests] = await Promise.all([
    findFoldersByCollection(params.id),
    findRequestsByCollection(params.id),
  ])

  const format = new URL(req.url).searchParams.get('format') ?? 'kayscope'
  const safeName = collection.name.replace(/[^a-z0-9_-]/gi, '_')

  if (format === 'postman') {
    const topFolders = folders.filter(f => !f.parentFolderId)
    const topRequests = requests.filter(r => !r.folderId)
    const postman = {
      info: {
        name: collection.name,
        description: collection.description ?? '',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        ...topRequests.map(r => buildPostmanRequest(r as Request)),
        ...topFolders.map(f => buildPostmanFolder(f.id, folders as Folder[], requests as Request[])),
      ],
      variable: (collection.variables ?? []).map(v => ({ key: v.key, value: v.value, enabled: v.enabled })),
    }
    return new NextResponse(JSON.stringify(postman, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeName}.postman_collection.json"`,
      },
    })
  }

  if (format === 'openapi') {
    const spec = buildOpenApiSpec(collection.name, collection.description ?? '', requests as Request[])
    return new NextResponse(JSON.stringify(spec, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeName}.openapi.json"`,
      },
    })
  }

  // Default: KayScope Collection Format v1
  const exported = {
    _kayscope: '1.0',
    id: collection.id,
    name: collection.name,
    description: collection.description ?? '',
    variables: collection.variables ?? [],
    folders: folders.map(f => ({ id: f.id, name: f.name, parentFolderId: f.parentFolderId ?? null })),
    requests: requests.map(r => ({
      id: r.id, name: r.name, folderId: r.folderId ?? null,
      method: r.method, url: r.url,
      params: r.params ?? [], headers: r.headers ?? [],
      body: r.body ?? { type: 'none', content: '' },
      auth: r.auth ?? { type: 'none' },
      preRequestScript: r.preRequestScript ?? '',
      postRequestScript: r.postRequestScript ?? '',
    })),
    exportedAt: new Date().toISOString(),
  }

  return new NextResponse(JSON.stringify(exported, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${safeName}.kayscope.json"`,
    },
  })
}
