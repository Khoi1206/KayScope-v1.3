import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { requireActiveWorkspace } from '@/lib/auth/workspace-guard'
import { getHistory } from '@/db/queries/history'
import { withErrorHandler } from '@/lib/api/respond'

export function GET(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireSession()
    const workspace = await requireActiveWorkspace(req, session.user.id)

    const cursorParam = req.nextUrl.searchParams.get('cursor')
    let cursor: { createdAt: Date; id: string } | undefined
    if (cursorParam) {
      try {
        const raw = JSON.parse(decodeURIComponent(cursorParam))
        if (raw && typeof raw.id === 'string' && raw.createdAt) {
          cursor = { id: raw.id, createdAt: new Date(raw.createdAt) }
        }
      } catch {
        // Ignore malformed cursor — treat as first-page request
      }
    }

    const result = await getHistory(workspace.id, { cursor })
    return NextResponse.json(result)
  })
}
