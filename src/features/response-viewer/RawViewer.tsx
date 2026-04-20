'use client'

interface Props {
  body: string
}

export default function RawViewer({ body }: Props) {
  if (!body) return <p className="px-4 py-4 text-xs text-th-fg-subtle">No response body</p>

  const formatted = (() => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  })()

  return (
    <pre className="whitespace-pre-wrap break-all px-4 py-4 font-mono text-xs text-th-fg">
      {formatted}
    </pre>
  )
}
