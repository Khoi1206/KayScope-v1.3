import { NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth/auth'

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 413 })
  }

  const uploadId = randomUUID()
  const tempPath = join(tmpdir(), 'kayscope-' + uploadId)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(tempPath, buffer)

  return NextResponse.json({
    uploadId,
    fileName: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId')
  if (!uploadId || !/^[0-9a-f-]{36}$/.test(uploadId)) {
    return NextResponse.json({ error: 'Invalid uploadId' }, { status: 400 })
  }

  const tempPath = join(tmpdir(), 'kayscope-' + uploadId)
  try {
    await unlink(tempPath)
  } catch {
    // File already gone — not an error
  }

  return NextResponse.json({ ok: true })
}
