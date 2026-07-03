'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Send, Save, ChevronDown, Code } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import VarHighlight from '@/components/VarHighlight'
import VarHoverPopover, { type SaveScope, type VarScope } from '@/components/VarHoverPopover'
import { interpolateWithStatus } from '@/core/interpolation/engine'
import { emptyScopes, mergeScopes } from '@/core/interpolation/scope'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const METHOD_COLORS: Record<string, string> = {
  GET:     'text-green-400',
  POST:    'text-blue-400',
  PUT:     'text-yellow-400',
  PATCH:   'text-orange-400',
  DELETE:  'text-red-400',
  HEAD:    'text-purple-400',
  OPTIONS: 'text-cyan-400',
}

interface Props {
  method: string
  url: string
  onMethodChange: (method: string) => void
  onUrlChange: (url: string) => void
  onSend: () => void
  sending: boolean
  localScope?: Record<string, string>
  environmentVariables?: Record<string, string>
  collectionVariables?: Record<string, string>
  globalVariables?: Record<string, string>
  onSave?: () => void
  isDirty?: boolean
  saving?: boolean
  isNewRequest?: boolean
  onSetLocalVar?: (name: string, value: string) => void
  onSaveVar?: (scope: SaveScope, name: string, value: string) => Promise<void>
  hasCollection?: boolean
  hasEnvironment?: boolean
  collectionName?: string
  environmentName?: string
  onNavigateToVariables?: () => void
  onShowSnippet?: () => void
}

function detectScope(
  name: string,
  local: Record<string, string>,
  env: Record<string, string>,
  col: Record<string, string>,
  global: Record<string, string>,
): VarScope {
  if (name in local) return 'local'
  if (name in env) return 'environment'
  if (name in col) return 'collection'
  if (name in global) return 'global'
  return null
}

export default function UrlBar({
  method, url, onMethodChange, onUrlChange, onSend, sending,
  localScope = {}, environmentVariables = {}, collectionVariables = {}, globalVariables = {},
  onSave, isDirty = false, saving = false, isNewRequest = false,
  onSetLocalVar, onSaveVar,
  hasCollection = false, hasEnvironment = false,
  collectionName, environmentName, onNavigateToVariables,
  onShowSnippet,
}: Props) {
  const t = useTranslations('request')
  const inputRef = useRef<HTMLInputElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [methodOpen, setMethodOpen] = useState(false)
  const methodRef = useRef<HTMLDivElement>(null)
const [hovered, setHovered] = useState<{ name: string; rect: DOMRect } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
  const savingRef = useRef(false)

  useEffect(() => {
    if (!methodOpen) return
    function onClickOutside(e: MouseEvent) {
      if (methodRef.current && !methodRef.current.contains(e.target as Node)) {
        setMethodOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [methodOpen])

  const allVars: Record<string, string> = {
    ...globalVariables, ...collectionVariables, ...environmentVariables, ...localScope,
  }

  const scopes = mergeScopes(emptyScopes(), {
    local: localScope,
    environment: { ...globalVariables, ...collectionVariables, ...environmentVariables },
  })
  const { result: resolvedUrl, hasUnresolved } = interpolateWithStatus(url, scopes)

  let sendDisabled = sending
  if (hasUnresolved) {
    try { new URL(resolvedUrl) } catch { sendDisabled = true }
  }

  const showOverlay = /\{\{(\$?[a-zA-Z_][a-zA-Z0-9_.\-]*)\}\}/g.test(url)

  function openHover(name: string, rect: DOMRect) {
    clearTimeout(closeTimer.current)
    setHovered({ name, rect })
  }
  function scheduleClose() { closeTimer.current = setTimeout(() => { if (!savingRef.current) setHovered(null) }, 600) }
  function cancelClose() { clearTimeout(closeTimer.current) }

  return (
    <div className="border-b border-th-border bg-th-bg">
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Method selector */}
        <div ref={methodRef} className="relative shrink-0">
          <button
            onClick={() => setMethodOpen(v => !v)}
            className={cn(
              'flex items-center gap-1 rounded-lg border border-th-border bg-th-input px-2 py-1 text-xs font-bold transition-colors hover:border-th-fg-subtle focus:outline-none',
              METHOD_COLORS[method] ?? 'text-th-fg-muted'
            )}
          >
            <span className="min-w-[42px] text-left">{method}</span>
            <ChevronDown size={11} className="text-th-fg-subtle" />
          </button>
          {methodOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[96px] rounded-xl border border-th-border bg-th-raised py-1 shadow-xl">
              {HTTP_METHODS.map(m => (
                <button
                  key={m}
                  onClick={() => { onMethodChange(m); setMethodOpen(false) }}
                  className={cn(
                    'flex w-full items-center px-3 py-1.5 text-xs font-bold transition-colors hover:bg-th-surface-hover',
                    METHOD_COLORS[m] ?? 'text-th-fg-muted',
                    m === method && 'bg-th-surface-hover'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            onScroll={e => setScrollLeft((e.target as HTMLInputElement).scrollLeft)}
            placeholder="https://api.example.com/{{endpoint}}"
            className={cn(
              'w-full rounded-lg border bg-th-input px-3 py-1 font-mono text-sm placeholder:text-th-fg-subtle focus:outline-none focus:ring-1',
              hasUnresolved
                ? 'border-yellow-500/40 focus:ring-yellow-500/40'
                : 'border-th-border focus:border-th-accent focus:ring-th-accent/50'
            )}
            style={showOverlay ? { color: 'transparent', caretColor: '#94a3b8' } : undefined}
          />
          {showOverlay && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded px-3 py-1" aria-hidden>
              <div
                className="flex h-full items-center whitespace-pre font-mono text-sm"
                style={{ transform: `translateX(${-scrollLeft}px)` }}
              >
                <VarHighlight text={url} allVars={allVars} className="text-th-fg" onVarHover={openHover} onVarLeave={scheduleClose} />
              </div>
            </div>
          )}
          {hasUnresolved && !showOverlay && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-yellow-500" title="Some variables are unresolved">⚠</span>
          )}
        </div>

        {onShowSnippet && (
          <button
            onClick={onShowSnippet}
            title="Code snippet"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-th-border px-2.5 py-1 text-xs font-medium text-th-fg-muted transition-colors hover:border-th-accent hover:text-th-fg"
          >
            <Code size={12} />
            Code
          </button>
        )}

        {onSave && (
          <button
            onClick={onSave}
            disabled={isNewRequest ? saving : (!isDirty || saving)}
            title={isNewRequest ? `${t('save')} (Ctrl+S)` : (isDirty ? `${t('save')} (Ctrl+S)` : t('saved'))}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-th-border px-2.5 py-1 text-xs font-medium text-th-fg-muted transition-colors hover:border-th-accent hover:text-th-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={12} />
            {saving ? t('saving') : t('save')}
          </button>
        )}

        <button
          onClick={onSend}
          disabled={sendDisabled}
          title={`${t('send')} (Ctrl+Enter)`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-th-accent px-4 py-1 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={12} />
          {sending ? t('sending') : t('send')}
        </button>
      </div>

      {hovered && (
        <VarHoverPopover
          name={hovered.name}
          scope={detectScope(hovered.name, localScope, environmentVariables, collectionVariables, globalVariables)}
          value={allVars[hovered.name]}
          anchor={hovered.rect}
          hasCollection={hasCollection}
          hasEnvironment={hasEnvironment}
          collectionName={collectionName}
          environmentName={environmentName}
          onNavigateToVariables={onNavigateToVariables}
          onSet={async (scope, value) => {
            savingRef.current = true
            clearTimeout(closeTimer.current)
            try {
              if (scope === 'local') {
                onSetLocalVar?.(hovered.name, value)
              } else {
                await onSaveVar?.(scope, hovered.name, value)
              }
              setHovered(null)
            } catch (e) {
              throw e
            } finally {
              savingRef.current = false
            }
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  )
}
