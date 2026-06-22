import { getWorkspaceHeaders } from '@/store/workspace.store'

/**
 * Download a file from a workspace-scoped API route.
 *
 * `window.open()` cannot attach the `X-Workspace-Id` header, so exports would
 * silently resolve against the wrong workspace for any user with more than
 * one workspace. Fetching the blob ourselves lets us send the same header
 * every other workspace-scoped request uses, then trigger the save via a
 * synthetic anchor click.
 */
export async function downloadFile(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, { headers: getWorkspaceHeaders() })
  if (!res.ok) {
    let message = 'Export failed'
    try {
      const data = await res.json()
      message = data.error ?? message
    } catch {
      // response wasn't JSON; keep default message
    }
    throw new Error(message)
  }

  const disposition = res.headers.get('Content-Disposition')
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? fallbackFilename

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}
