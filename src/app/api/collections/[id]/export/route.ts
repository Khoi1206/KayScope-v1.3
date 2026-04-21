import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { findWorkspaceByOwner } from '@/db/queries/workspaces'
import { findCollectionByIdForWorkspace } from '@/db/queries/collections'
import { findFoldersByCollection } from '@/db/queries/folders'
import { findRequestsByCollection } from '@/db/queries/requests'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await findWorkspaceByOwner(session.user.id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const collection = await findCollectionByIdForWorkspace(params.id, workspace.id)
  if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

  const [folders, requests] = await Promise.all([
    findFoldersByCollection(params.id),
    findRequestsByCollection(params.id),
  ])

  // Build export payload (KayScope Collection Format v1)
  const exported = {
    _kayscope: '1.0',
    id: collection.id,
    name: collection.name,
    description: collection.description ?? '',
    variables: collection.variables ?? [],
    folders: folders.map(f => ({
      id: f.id,
      name: f.name,
      parentFolderId: f.parentFolderId ?? null,
    })),
    requests: requests.map(r => ({
      id: r.id,
      name: r.name,
      folderId: r.folderId ?? null,
      method: r.method,
      url: r.url,
      params: r.params ?? [],
      headers: r.headers ?? [],
      body: r.body ?? { type: 'none', content: '' },
      auth: r.auth ?? { type: 'none' },
      preRequestScript: r.preRequestScript ?? '',
      postRequestScript: r.postRequestScript ?? '',
    })),
    exportedAt: new Date().toISOString(),
  }

  const filename = `${collection.name.replace(/[^a-z0-9_-]/gi, '_')}.kayscope.json`

  return new NextResponse(JSON.stringify(exported, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
