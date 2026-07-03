import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { findFlowRunByIdForWorkspace } from '@/db/queries/flow_runs'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

const ARTIFACTS_BASE = path.join(process.cwd(), 'tests', 'e2e', 'generated', 'artifacts')

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.zip': 'application/zip', // Playwright trace file
  '.txt': 'text/plain',
}

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const { id } = await params
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)
    const run = await findFlowRunByIdForWorkspace(id, workspace.id)
    if (!run) throw new NotFoundError('Flow run')

    const relPath = req.nextUrl.searchParams.get('path')
    if (!relPath) throw new ValidationError('Missing "path" query parameter')

    // relPath comes from a run's own persisted testResults.attachments — but never
    // trust a client-supplied query param at face value. Resolve and confirm the
    // final path is still inside this run's own artifacts directory.
    const runArtifactsDir = path.join(ARTIFACTS_BASE, run.id)
    const resolved = path.resolve(runArtifactsDir, relPath)
    if (resolved !== runArtifactsDir && !resolved.startsWith(runArtifactsDir + path.sep)) {
      throw new ValidationError('Invalid artifact path')
    }

    let data: Buffer
    try {
      data = await readFile(resolved)
    } catch {
      throw new NotFoundError('Artifact')
    }

    const ext = path.extname(resolved).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  })
}
