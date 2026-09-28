import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { findUserByEmail, updateUserProfile } from '@/db/queries/users'
import { findValidToken, consumeToken } from '@/db/queries/password_reset_tokens'
import { resetPasswordSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'
import { sha256Hex } from '@/lib/crypto'
import { sendTemplateEmail } from '@/lib/mail/mailer'
import logger from '@/lib/logger'

/** POST /api/auth/reset-password — verify a 6-digit code and set a new password. */
export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const body = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const { email, code, newPassword, locale } = parsed.data
    const user = await findUserByEmail(email)
    if (!user) throw new ValidationError('Invalid or expired code')

    const token = await findValidToken(user.id, sha256Hex(code))
    if (!token) throw new ValidationError('Invalid or expired code')

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await updateUserProfile(user.id, { passwordHash })
    await consumeToken(token.id)

    sendTemplateEmail(
      user.email,
      locale === 'vi' ? 'Mật khẩu của bạn đã được thay đổi' : 'Your password has been changed',
      'forgot-password-success',
      locale,
      { name: user.name }
    ).catch(err => logger.error(err, '[reset-password] failed to send confirmation email'))

    return NextResponse.json({ success: true })
  })
}
