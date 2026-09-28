import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/session'
import { updateExample, deleteExample } from '@/db/queries/examples'
import { renameExampleSchema } from '@/schemas'
import { withErrorHandler } from '@/lib/api/respond'
import { NotFoundError, ValidationError } from '@/lib/errors'

type Params = { params: { id: string } }

export function PATCH(req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()

    const body = await req.json()
    const parsed = renameExampleSchema.safeParse(body)
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid input')

    const updated = await updateExample(params.id, session.user.id, { name: parsed.data.name })
    if (!updated) throw new NotFoundError('Example')

    return NextResponse.json(updated)
  })
}

export function DELETE(_req: NextRequest, { params }: Params) {
  return withErrorHandler(async () => {
    const session = await requireSession()

    const deleted = await deleteExample(params.id, session.user.id)
    if (!deleted) throw new NotFoundError('Example')

    return NextResponse.json({ success: true })
  })
}
