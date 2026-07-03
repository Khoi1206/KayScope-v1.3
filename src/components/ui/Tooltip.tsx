'use client'

import { useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './cn'

interface Props {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'right'
  className?: string
}

export default function Tooltip({ label, children, side = 'bottom', className }: Props) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  function show() {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      if (side === 'right') {
        setCoords({ x: rect.right + 8, y: rect.top + rect.height / 2 })
      } else {
        setCoords({
          x: rect.left + rect.width / 2,
          y: side === 'bottom' ? rect.bottom + 8 : rect.top - 8,
        })
      }
      setVisible(true)
    }, 350)
  }
  function hide() {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  const style =
    side === 'right'
      ? { left: coords.x, top: coords.y, transform: 'translateY(-50%)' }
      : { left: coords.x, top: coords.y, transform: `translate(-50%, ${side === 'bottom' ? '0' : '-100%'})` }

  return (
    <div ref={wrapperRef} className={cn('relative inline-flex', className)} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={style}
          className="pointer-events-none fixed z-[100] whitespace-nowrap rounded-lg border border-th-border/60 bg-th-surface/95 px-2.5 py-1 text-[11px] font-medium text-th-fg shadow-lg backdrop-blur-md"
        >
          {label}
        </div>,
        document.body
      )}
    </div>
  )
}
