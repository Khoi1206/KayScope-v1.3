'use client'

interface Props {
  headers: Record<string, string>
}

export default function HeadersViewer({ headers }: Props) {
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return <p className="px-4 py-4 text-xs text-th-fg-subtle">No response headers</p>
  }
  return (
    <table className="w-full text-xs">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-b border-th-border hover:bg-th-surface">
            <td className="w-48 px-4 py-1.5 font-mono font-semibold text-th-accent">{key}</td>
            <td className="px-4 py-1.5 font-mono text-th-fg-muted break-all">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
