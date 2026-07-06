import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getAdminUserStats } from '@/db/queries/users'
import { withErrorHandler } from '@/lib/api/respond'

/** GET /api/admin/stats — aggregate user counts for the admin dashboard (admin CMS only) */
export function GET() {
  return withErrorHandler(async () => {
    await requireAdmin()
    const stats = await getAdminUserStats()
    return NextResponse.json(stats)
  })
}
