import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail } from '@/db/queries/users'
import { createResetToken } from '@/db/queries/password_reset_tokens'
import { forgotPasswordRequestSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { ValidationError } from '@/lib/errors'
import { sha256Hex } from '@/lib/crypto'
import { sendTemplateEmail } from '@/lib/mail/mailer'
import { checkRateLimit } from '@/lib/execute/rate-limit'
import { getRedisClient } from '@/lib/redis'
import logger from '@/lib/logger'

const CODE_TTL_MS = 10 * 60 * 1000

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** POST /api/auth/forgot-password — request a 6-digit reset code. Always returns a generic success response to avoid leaking whether an email is registered. */
export function POST(req: NextRequest) {
  return withErrorHandler(async () => {
    const body = await req.json()
    const parsed = forgotPasswordRequestSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? '127.0.0.1'

    const allowed = await checkRateLimit(ip, getRedisClient()).catch(() => true)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests — please try again later' }, { status: 429 })
    }

    const { email, locale } = parsed.data
    const user = await findUserByEmail(email)

    if (user && user.isActive) {
      const code = generateCode()
      const codeHash = sha256Hex(code)
      const expiresAt = new Date(Date.now() + CODE_TTL_MS)
      await createResetToken(user.id, codeHash, expiresAt)

      sendTemplateEmail(
        user.email,
        locale === 'vi' ? 'Đặt lại mật khẩu của bạn' : 'Reset your password',
        'forgot-password',
        locale,
        { name: user.name, token: code }
      ).catch(err => logger.error(err, '[forgot-password] failed to send reset code email'))
    }

    // Same response whether or not the account exists.
    return NextResponse.json({ success: true })
  })
}
