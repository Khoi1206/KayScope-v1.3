import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getEmailSettings, upsertEmailSettings } from '@/db/queries/email_settings'
import { logAdminAction } from '@/db/queries/admin_audit_logs'
import { updateEmailSettingsSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'
import { encryptValue, maskValue } from '@/lib/crypto'

/** GET /api/admin/email-settings — current SMTP config, password masked (admin CMS only) */
export function GET() {
  return withErrorHandler(async () => {
    await requireAdmin()
    const settings = await getEmailSettings()
    return NextResponse.json({
      ...settings,
      password: settings.password ? maskValue() : '',
    })
  })
}

/** PUT /api/admin/email-settings — update SMTP config (admin CMS only) */
export function PUT(req: NextRequest) {
  return withErrorHandler(async () => {
    const session = await requireAdmin()
    const body = await req.json()
    const parsed = updateEmailSettingsSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const { password, ...rest } = parsed.data

    // Blank or still-masked password means "keep the current stored value".
    const passwordUpdate =
      password && password !== maskValue() ? { password: encryptValue(password) } : {}

    const updated = await upsertEmailSettings(
      { ...rest, ...passwordUpdate },
      session.user.id
    )

    await logAdminAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: 'update_email_settings',
      targetUserId: session.user.id,
      targetUserEmail: session.user.email,
      targetUserName: session.user.name ?? session.user.email,
    })

    return NextResponse.json({
      ...updated,
      password: updated.password ? maskValue() : '',
    })
  })
}
