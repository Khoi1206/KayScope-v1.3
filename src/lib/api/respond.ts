import { NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import logger from '@/lib/logger'

/** Wrap an async route handler with standard error handling. */
export function withErrorHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    logger.error(err, 'Unhandled route error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  })
}
