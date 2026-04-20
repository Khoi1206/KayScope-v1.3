'use client'

import { cn } from '@/components/ui/cn'

interface Props {
  text: string
  allVars: Record<string, string>
  className?: string
}

const VAR_RE = /(\{\{[^}]+\}\})/g

export default function VarHighlight({ text, allVars, className }: Props) {
  const parts = text.split(VAR_RE)
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([^}]+)\}\}$/)
        if (!match) return <span key={i}>{part}</span>
        const name = match[1]!.trim()
        const resolved = name in allVars
        return (
          <span
            key={i}
            className={cn(
              'font-mono text-xs',
              resolved ? 'text-th-accent' : 'text-yellow-400'
            )}
            title={resolved ? allVars[name] : 'Unresolved variable'}
          >
            {part}
          </span>
        )
      })}
    </span>
  )
}
