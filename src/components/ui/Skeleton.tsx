import React from 'react'
import { cn } from './cn'

// ── Base shimmer block ──────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Generic shimmer placeholder.
 * Use `className` to set width/height; the pulse and color are automatic.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded bg-th-surface-hover', className)}
      style={style}
    />
  )
}

// ── Composed skeletons for specific layouts ─────────────────────────────────

/** One collection-tree row: expand chevron + name bar + action icons */
export function CollectionRowSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-[7px]">
      {/* chevron placeholder */}
      <Skeleton className="h-3 w-3 shrink-0" />
      {/* name */}
      <Skeleton className="h-3 flex-1" style={{ maxWidth: `${52 + Math.random() * 32}%` }} />
      {/* action icons */}
      <Skeleton className="ml-auto h-3 w-3 shrink-0 opacity-30" />
      <Skeleton className="h-3 w-3 shrink-0 opacity-30" />
    </div>
  )
}

/** One request-tree row: method badge + name */
export function RequestRowSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-md py-[5px] pl-7 pr-2">
      <Skeleton className="h-2.5 w-8 shrink-0 rounded" />
      <Skeleton className="h-2.5 flex-1" style={{ maxWidth: `${40 + Math.random() * 45}%` }} />
    </div>
  )
}

/** One history-list entry: method+status row + URL + timestamp */
export function HistoryRowSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 border-b border-th-border/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-10 shrink-0 rounded" />
        <Skeleton className="h-3 w-8 shrink-0 rounded" />
        <Skeleton className="ml-auto h-3 w-12 shrink-0 rounded" />
      </div>
      <Skeleton className="h-2.5 w-full rounded" />
      <Skeleton className="h-2 w-16 rounded" />
    </div>
  )
}

/** One suite/flow list row: play icon + name + subtitle + menu */
export function ListRowSkeleton() {
  return (
    <div className="mx-1 flex items-center gap-2 rounded-md px-2 py-[9px]">
      {/* play icon */}
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
        <Skeleton className="h-3 rounded" style={{ width: `${45 + Math.random() * 35}%` }} />
        <Skeleton className="h-2.5 rounded" style={{ width: `${30 + Math.random() * 30}%` }} />
      </div>
      {/* context menu icon */}
      <Skeleton className="h-4 w-4 shrink-0 rounded opacity-30" />
    </div>
  )
}

/** One environment row: dot + name + action icons */
export function EnvRowSkeleton() {
  return (
    <div className="mx-1 flex items-center gap-2.5 rounded-md px-2 py-2">
      <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
      <Skeleton className="h-3 flex-1 rounded" style={{ maxWidth: `${40 + Math.random() * 40}%` }} />
      <Skeleton className="ml-auto h-3 w-16 shrink-0 rounded opacity-40" />
    </div>
  )
}

/** One global-variable row: key + value */
export function GlobalVarRowSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <Skeleton className="h-2.5 w-20 shrink-0 rounded" />
      <Skeleton className="h-2.5 flex-1 rounded opacity-50" style={{ maxWidth: `${35 + Math.random() * 30}%` }} />
    </div>
  )
}

/** Response panel loading state — shown while a request is in-flight */
export function ResponseLoadingSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* status bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-14 rounded" />
        <Skeleton className="ml-auto h-4 w-20 rounded" />
      </div>
      {/* body lines */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3 rounded"
            style={{ width: `${30 + Math.random() * 65}%` }}
          />
        ))}
      </div>
    </div>
  )
}
