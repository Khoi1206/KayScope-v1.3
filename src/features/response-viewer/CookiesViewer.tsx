'use client'

import type { ResponseCookie } from '@/store/request.store'

interface Props {
  cookies?: ResponseCookie[]
}

export default function CookiesViewer({ cookies }: Props) {
  if (!cookies || cookies.length === 0) {
    return <p className="px-4 py-4 text-xs text-th-fg-subtle">No cookies were set by this response</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-th-border">
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Name</th>
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Value</th>
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Domain / Path</th>
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Expires</th>
          <th className="px-4 pb-2 pt-3 text-left text-[11px] font-semibold uppercase tracking-widest text-th-fg-subtle">Flags</th>
        </tr>
      </thead>
      <tbody>
        {cookies.map((c, i) => (
          <tr key={`${c.name}-${i}`} className="border-b border-th-border/40 transition-colors hover:bg-th-surface-hover/40">
            <td className="px-4 py-2 font-mono font-medium text-th-accent">{c.name}</td>
            <td className="max-w-[240px] px-4 py-2 font-mono text-th-fg-muted break-all">{c.value}</td>
            <td className="px-4 py-2 font-mono text-th-fg-muted">{c.domain}{c.path}</td>
            <td className="px-4 py-2 text-th-fg-muted">{c.expires ? new Date(c.expires).toLocaleString() : 'Session'}</td>
            <td className="px-4 py-2 text-th-fg-muted">
              {[c.httpOnly && 'HttpOnly', c.secure && 'Secure', c.sameSite && `SameSite=${c.sameSite}`].filter(Boolean).join(', ') || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
