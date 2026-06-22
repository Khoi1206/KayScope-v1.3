import { NextResponse } from 'next/server'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { randomUUID } from 'crypto'
import { auth } from '@/lib/auth/auth'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const UPLOADS_ROOT = join(process.cwd(), 'public', 'uploads')

function sanitizeName(name: string): string {
  return basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128)
}

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
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  const folder = (formData.get('folder') as string | null)?.replace(/[^a-zA-Z0-9_-]/g, '') || 'general'
  const userId = session.user.id
  const dirPath = join(UPLOADS_ROOT, userId, folder)
  await mkdir(dirPath, { recursive: true })

  const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeName(file.name)}`
  const filePath = join(dirPath, safeName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const url = `/uploads/${userId}/${folder}/${safeName}`

  return NextResponse.json({
    url,
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
  const url = searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Only allow deleting files under the authenticated user's own folder
  const userId = session.user.id
  const expectedPrefix = `/uploads/${userId}/`
  if (!url.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent path traversal
  const relativePath = url.slice('/uploads/'.length)
  if (relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const filePath = join(UPLOADS_ROOT, relativePath)
  try {
    await unlink(filePath)
  } catch {
    // Already gone — not an error
  }

  return NextResponse.json({ ok: true })
}
