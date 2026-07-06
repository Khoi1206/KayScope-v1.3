import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { listAdminAuditLogs } from '@/db/queries/admin_audit_logs'
import { withErrorHandler } from '@/lib/api/respond'

/** GET /api/admin/audit-logs — last 100 admin CMS actions (admin CMS only) */
export function GET() {
  return withErrorHandler(async () => {
    await requireAdmin()
    const rows = await listAdminAuditLogs(100)
    return NextResponse.json(rows)
  })
}
