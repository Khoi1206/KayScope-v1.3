import { NextResponse } from 'next/server'
import { AppError } from '@/lib/errors'
import logger from '@/lib/logger'

function isNextControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && (
    digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_')
  )
}

/** Wrap an async route handler with standard error handling. */
export function withErrorHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    if (isNextControlFlowError(err)) throw err
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    logger.error(err, 'Unhandled route error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  })
}
