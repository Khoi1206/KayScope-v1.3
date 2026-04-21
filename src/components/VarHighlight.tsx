'use client'

import { cn } from '@/components/ui/cn'

interface Props {
  text: string
  allVars: Record<string, string>
  className?: string
  /** Called when the user hovers a {{var}} token. Enables pointer events on var spans. */
  onVarHover?: (name: string, rect: DOMRect) => void
  onVarLeave?: () => void
}

const VAR_RE = /(\{\{[^}]+\}\})/g

export default function VarHighlight({ text, allVars, className, onVarHover, onVarLeave }: Props) {
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
              resolved ? 'text-th-accent' : 'text-yellow-400',
              onVarHover && 'cursor-pointer underline decoration-dotted underline-offset-2',
            )}
            style={onVarHover ? { pointerEvents: 'auto' } : undefined}
            title={resolved ? allVars[name] : 'Unresolved variable'}
            onMouseEnter={onVarHover ? e => onVarHover(name, (e.currentTarget as HTMLElement).getBoundingClientRect()) : undefined}
            onMouseLeave={onVarLeave}
          >
            {part}
          </span>
        )
      })}
    </span>
  )
}
