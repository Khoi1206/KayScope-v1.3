import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { testEmailSettingsSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError, AppError } from '@/lib/errors'
import { sendTestEmail } from '@/lib/mail/mailer'
import logger from '@/lib/logger'

/** POST /api/admin/email-settings/test — send a test email using the saved SMTP config (admin CMS only) */
export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    await requireAdmin()
    const body = await req.json()
    const parsed = testEmailSettingsSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    try {
      await sendTestEmail(parsed.data.to)
      return NextResponse.json({ success: true })
    } catch (err) {
      if (err instanceof AppError) throw err
      logger.error(err, 'sendTestEmail failed')
      const message = err instanceof Error ? err.message : 'Failed to send test email'
      return NextResponse.json({ success: false, error: message }, { status: 200 })
    }
  })
}
