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
      <thead>
        <tr className="border-b border-th-border">
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Header</th>
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-b border-th-border/40 transition-colors hover:bg-th-surface-hover/40">
            <td className="w-56 px-4 py-2 font-mono font-medium text-th-accent">{key}</td>
            <td className="px-4 py-2 font-mono text-th-fg-muted break-all">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
