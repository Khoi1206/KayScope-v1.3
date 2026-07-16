'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus, ChevronDown, Search, Inbox, RotateCcw, History, Rows2, Columns2 } from 'lucide-react'
import { useRequestStore } from '@/store/request.store'
import { useEnvironmentStore } from '@/store/environment.store'
import { useWorkspaceStore, getWorkspaceHeaders } from '@/store/workspace.store'
import { useCollectionStore } from '@/store/collection.store'
import { cn } from '@/components/ui/cn'
import UrlBar from './UrlBar'
import ParamsTab from './ParamsTab'
import HeadersTab from './HeadersTab'
import BodyTab from './BodyTab'
import AuthTab from './AuthTab'
import ScriptsTab from './ScriptsTab'
import SettingsTab, { defaultSettings } from './SettingsTab'
import ResponsePanel from '@/features/response-viewer/ResponsePanel'
import { ResponseLoadingSkeleton } from '@/components/ui/Skeleton'
import VariablesPanel from '@/features/variables/VariablesPanel'
import UnsavedChangesDialog from './UnsavedChangesDialog'
import SaveRequestModal from './SaveRequestModal'
import RequestVersionsPanel from './RequestVersionsPanel'
import CodeSnippetModal from '@/components/CodeSnippetModal'
import { toServerScopes } from '@/core/interpolation/scope'
import { useEscapeKey } from '@/hooks/useEscapeKey'

type EditorTab = 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'settings' | 'variables'

function nanoidLocal() {
  return Math.random().toString(36).slice(2, 11)
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-cyan-400',
}

export default function RequestEditorPane() {
  const t = useTranslations('request')
  const tn = useTranslations('nav')
  const {
    tabs,
    snapshots,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    updateSnapshot,
    saveRequest,
    renameTab,
    attachRequest,
    markClean,
    restoreVersion,
  } = useRequestStore()
  const { environments, activeEnvironmentId, setActiveEnvironment, updateEnvironment } = useEnvironmentStore()
  const { workspace, activeWorkspaceId, updateGlobalVariables } = useWorkspaceStore()
  const { collections, folders, requests: storeRequests, fetchRequests, updateCollection, renameRequest, patchRequest } = useCollectionStore()
  const [editorTab, setEditorTab] = useState<EditorTab>('params')
  const [saving, setSaving] = useState(false)
  const [showSnippet, setShowSnippet] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showTabList, setShowTabList] = useState(false)
  const [tabListSearch, setTabListSearch] = useState('')
  const [maxVisible, setMaxVisible] = useState(7)
  const [tabWidth, setTabWidth] = useState(120)
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null)
  const [closeSaving, setCloseSaving] = useState(false)
  const [closeSaveError, setCloseSaveError] = useState<string | null>(null)
  const [saveModalForTabId, setSaveModalForTabId] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [pendingCloseNewTabId, setPendingCloseNewTabId] = useState<string | null>(null)
  const [responseKey, setResponseKey] = useState(0)
  const handleSaveRef = useRef<() => void>(() => {})
  const handleSendRef = useRef<() => void>(() => {})
  const handleCloseTabRef = useRef<() => void>(() => {})
  const handleNextTabRef = useRef<() => void>(() => {})
  const handlePrevTabRef = useRef<() => void>(() => {})
  const tabListRef = useRef<HTMLDivElement>(null)

  useEscapeKey(() => { if (pendingCloseNewTabId) setPendingCloseNewTabId(null) })
  const tabBarRef = useRef<HTMLDivElement>(null)
  const rightControlsRef = useRef<HTMLDivElement>(null)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const [responseRatio, setResponseRatio] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.4
    const saved = parseFloat(localStorage.getItem('response-ratio') ?? '')
    return isNaN(saved) ? 0.4 : Math.min(0.85, Math.max(0.15, saved))
  })
  const [isResizingResponse, setIsResizingResponse] = useState(false)
  const [responsePosition, setResponsePosition] = useState<'bottom' | 'right'>(() => {
    if (typeof window === 'undefined') return 'bottom'
    return localStorage.getItem('response-position') === 'right' ? 'right' : 'bottom'
  })

  function toggleResponsePosition() {
    setResponsePosition(prev => {
      const next = prev === 'bottom' ? 'right' : 'bottom'
      localStorage.setItem('response-position', next)
      return next
    })
  }

  // Measure tab bar width → compute how many tabs fit
  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    const check = () => {
      const right = rightControlsRef.current
      const TAB_W = 120
      const GAP = 4
      const PLUS_BTN = 36
      const PAD = 12 // px-1.5 × 2 sides
      const available = bar.clientWidth - (right?.clientWidth ?? 200) - PAD - PLUS_BTN
      const count = Math.max(1, Math.floor(available / (TAB_W + GAP)))
      setMaxVisible(count)
      // Stretch tab width to consume the exact leftover space when the strip is full,
      // so no dead gap is left before the right-aligned controls.
      setTabWidth(Math.max(80, Math.floor((available - GAP * (count - 1)) / count)))
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  // Close tab list dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (tabListRef.current && !tabListRef.current.contains(e.target as Node)) {
        setShowTabList(false)
      }
    }
    if (showTabList) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showTabList])

  useEffect(() => {
    if (!isResizingResponse) return
    function computeRatio(e: MouseEvent) {
      const container = splitContainerRef.current
      if (!container) return null
      const rect = container.getBoundingClientRect()
      const newResponseSize = responsePosition === 'bottom' ? rect.bottom - e.clientY : rect.right - e.clientX
      const total = responsePosition === 'bottom' ? rect.height : rect.width
      return Math.min(0.85, Math.max(0.15, newResponseSize / total))
    }
    const onMouseMove = (e: MouseEvent) => {
      const newRatio = computeRatio(e)
      if (newRatio !== null) setResponseRatio(newRatio)
    }
    const onMouseUp = (e: MouseEvent) => {
      const newRatio = computeRatio(e)
      if (newRatio !== null) localStorage.setItem('response-ratio', String(newRatio))
      setIsResizingResponse(false)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isResizingResponse, responsePosition])

  const activeEnv = environments.find(e => e.id === activeEnvironmentId)
  const envVars = Object.fromEntries(
    (activeEnv?.variables ?? [])
      .filter(v => v.enabled)
      .map(v => [v.key, v.value])
  )

  // Global vars are lowest priority — env and local override them
  const globalVars = Object.fromEntries(
    (workspace?.globalVariables ?? [])
      .filter(v => v.enabled)
      .map(v => [v.key, v.value])
  )

  const activeTab = activeTabId ? tabs.find(t => t.id === activeTabId) : null
  const activeCollection = activeTab?.collectionId
    ? collections.find(c => c.id === activeTab.collectionId)
    : null
  const collectionVars = Object.fromEntries(
    (activeCollection?.variables ?? [])
      .filter(v => v.enabled)
      .map(v => [v.key, v.value])
  )

  const hasCollection = !!activeTab?.collectionId
  const hasEnvironment = !!activeEnvironmentId

  const snap = activeTabId ? snapshots[activeTabId] : null

  // Sync name draft when active tab changes
  useEffect(() => {
    setNameDraft(activeTab?.title ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId])

  function confirmNameEdit() {
    if (!activeTabId) return
    const trimmed = nameDraft.trim() || 'Untitled Request'
    if (trimmed !== activeTab?.title) {
      renameTab(activeTabId, trimmed)
      if (activeTab?.requestId) handleSaveRef.current()
    }
  }

  function handleRevert() {
    if (!activeTabId || !activeTab?.requestId || !activeTab.collectionId) return
    const savedReq = (storeRequests[activeTab.collectionId] ?? []).find(r => r.id === activeTab.requestId)
    if (!savedReq) return
    updateSnapshot(activeTabId, {
      method: savedReq.method || 'GET',
      url: savedReq.url || '',
      params: savedReq.params ?? [],
      headers: savedReq.headers ?? [],
      body: savedReq.body
        ? { ...savedReq.body, content: savedReq.body.content ?? '' } as import('@/store/request.store').RequestBody
        : { type: 'none', content: '' },
      auth: savedReq.auth ?? { type: 'none' },
      preRequestScript: savedReq.preRequestScript ?? '',
      postRequestScript: savedReq.postRequestScript ?? '',
    })
    markClean(activeTabId)
    setNameDraft(activeTab.title)
  }

  async function handleRestoreVersion(versionId: string) {
    if (!activeTabId || !activeTab?.requestId) return
    const restored = await restoreVersion(activeTab.requestId, versionId)
    updateSnapshot(activeTabId, restored)
    markClean(activeTabId)
    // Keep the sidebar/breadcrumb cache in sync with the restored content
    if (activeTab.collectionId) {
      patchRequest(activeTab.requestId, activeTab.collectionId, restored)
    }
  }

  function newTab() {
    openTab({ id: nanoidLocal(), title: t('newTab') })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSendRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'w') {
        e.preventDefault()
        handleCloseTabRef.current()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) handlePrevTabRef.current()
        else handleNextTabRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleSend() {
    if (!activeTabId || !snap) return
    updateSnapshot(activeTabId, { sending: true, response: null })

    try {
      const serverScopes = toServerScopes({
        request: {},
        local: snap.localScope,
        data: {},
        environment: envVars,
        collection: {},
        global: {},
      })

      const settings = snap.settings ?? defaultSettings()
      const payload = {
        method: snap.method,
        url: snap.url,
        params: snap.params.filter(p => p.enabled && p.key),
        headers: snap.headers.filter(h => h.enabled && h.key),
        body: snap.body.type !== 'none' ? snap.body : undefined,
        auth: snap.auth.type !== 'none' ? snap.auth : undefined,
        preRequestScript: snap.preRequestScript || undefined,
        postRequestScript: snap.postRequestScript || undefined,
        workspaceId: activeWorkspaceId ?? '__workspace__',
        environmentId: activeEnvironmentId ?? undefined,
        collectionId: activeTab?.collectionId ?? undefined,
        requestId: activeTab?.requestId ?? undefined,
        scopes: serverScopes,
        timeout: settings.timeout,
        followRedirects: settings.followRedirects,
        maxRedirects: settings.maxRedirects,
        sendCookies: settings.sendCookies,
        saveCookies: settings.saveCookies,
        sslVerify: settings.sslVerify,
      }

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getWorkspaceHeaders() },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      // Normalize: server error paths return { error } with no headers/body/status
      updateSnapshot(activeTabId, {
        sending: false,
        response: {
          status: data.status ?? 0,
          statusText: data.statusText ?? data.error ?? 'Error',
          headers: data.headers ?? {},
          body: data.body ?? data.error ?? '',
          durationMs: data.durationMs ?? 0,
          ttfbMs: data.ttfbMs,
          downloadMs: data.downloadMs,
          isBinary: data.isBinary,
          cookies: data.cookies,
          size: data.size ?? 0,
          tests: data.tests,
          logs: data.logs,
          preScriptError: data.preScriptError,
          postScriptError: data.postScriptError,
        },
      })
    } catch (err) {
      updateSnapshot(activeTabId, {
        sending: false,
        response: {
          status: 0,
          statusText: 'Network Error',
          headers: {},
          body: String(err),
          durationMs: 0,
          size: 0,
        },
      })
    } finally {
      setResponseKey(k => k + 1)
    }
  }

  async function handleSave() {
    if (!activeTabId) return
    // New unsaved tab — open the save-to-collection modal
    if (!activeTab?.requestId) {
      setSaveModalForTabId(activeTabId)
      return
    }
    setSaving(true)
    try {
      // Commit any pending name edit before saving.
      // This handles Ctrl+S / Save button click while the name input is still
      // focused with an unconfirmed change (blur/Enter not yet pressed).
      const pendingName = nameDraft.trim() || 'Untitled Request'
      if (pendingName !== (activeTab?.title ?? '')) {
        renameTab(activeTabId, pendingName)
      }
      await saveRequest(activeTabId)
      // Sync method + name to sidebar using fresh store state (avoids stale closure)
      const { tabs: ft, snapshots: fs } = useRequestStore.getState()
      const freshTab = ft.find(t => t.id === activeTabId)
      const freshSnap = fs[activeTabId]
      if (freshTab?.requestId && freshTab.collectionId && freshSnap) {
        patchRequest(freshTab.requestId, freshTab.collectionId, {
          name: freshTab.title,
          method: freshSnap.method,
          url: freshSnap.url,
          params: freshSnap.params,
          headers: freshSnap.headers,
          body: freshSnap.body,
          auth: freshSnap.auth,
          preRequestScript: freshSnap.preRequestScript,
          postRequestScript: freshSnap.postRequestScript,
        })
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  // Keep refs in sync to avoid stale closures in the keydown listener
  handleSaveRef.current = handleSave
  handleSendRef.current = handleSend
  handleCloseTabRef.current = () => {
    if (!activeTabId) return
    const tab = tabs.find(t => t.id === activeTabId)
    if (!tab) return
    if (tab.isDirty) {
      if (tab.requestId) { setCloseSaveError(null); setPendingCloseTabId(tab.id) }
      else if (isSnapshotModified(snapshots[tab.id])) { setPendingCloseNewTabId(tab.id) }
      else { closeTab(tab.id) }
    } else {
      closeTab(tab.id)
    }
  }
  handleNextTabRef.current = () => {
    if (tabs.length < 2) return
    const idx = tabs.findIndex(t => t.id === activeTabId)
    setActiveTab(tabs[(idx + 1) % tabs.length]!.id)
  }
  handlePrevTabRef.current = () => {
    if (tabs.length < 2) return
    const idx = tabs.findIndex(t => t.id === activeTabId)
    setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]!.id)
  }

  function isSnapshotModified(snap: (typeof snapshots)[string] | undefined): boolean {
    if (!snap) return false
    return (
      snap.url !== '' ||
      snap.method !== 'GET' ||
      snap.params.some(p => p.enabled && p.key) ||
      snap.headers.some(h => h.enabled && h.key) ||
      snap.body.type !== 'none' ||
      snap.auth.type !== 'none' ||
      !!(snap.preRequestScript?.trim()) ||
      !!(snap.postRequestScript?.trim())
    )
  }

  async function onSaveVar(scope: 'local' | 'collection' | 'environment' | 'global', name: string, value: string) {
    if (scope === 'local') {
      if (activeTabId) updateSnapshot(activeTabId, { localScope: { ...(snapshots[activeTabId]?.localScope ?? {}), [name]: value } })
      return
    }
    if (scope === 'collection' && activeTab?.collectionId) {
      const col = collections.find(c => c.id === activeTab!.collectionId)
      if (!col) throw new Error('Collection not found')
      const existing = col.variables ?? []
      const idx = existing.findIndex(v => v.key === name)
      const newVars = idx >= 0 ? existing.map((v, i) => i === idx ? { ...v, value } : v) : [...existing, { key: name, value, enabled: true }]
      await updateCollection(activeTab!.collectionId!, { variables: newVars })
    } else if (scope === 'environment' && activeEnvironmentId) {
      const env = environments.find(e => e.id === activeEnvironmentId)
      if (!env) throw new Error('Environment not found')
      const existing = env.variables ?? []
      const idx = existing.findIndex(v => v.key === name)
      const newVars = idx >= 0 ? existing.map((v, i) => i === idx ? { ...v, value } : v) : [...existing, { key: name, value, enabled: true }]
      await updateEnvironment(activeEnvironmentId, { variables: newVars })
    } else if (scope === 'global') {
      if (!workspace) throw new Error('Workspace not loaded')
      const existing = workspace.globalVariables ?? []
      const idx = existing.findIndex(v => v.key === name)
      const newVars = idx >= 0 ? existing.map((v, i) => i === idx ? { ...v, value } : v) : [...existing, { key: name, value, enabled: true }]
      await updateGlobalVariables(newVars)
    } else {
      throw new Error(`Cannot save: scope '${scope}' is not available`)
    }
    // Evict local override so the saved persistent scope wins
    if (activeTabId && name in (snapshots[activeTabId]?.localScope ?? {})) {
      const newLocal = { ...snapshots[activeTabId].localScope }
      delete newLocal[name]
      updateSnapshot(activeTabId, { localScope: newLocal })
    }
  }

  const activeSettings = snap?.settings ?? defaultSettings()

  // URL → Params sync: extract query params from pasted URL
  function handleUrlChange(url: string) {
    if (!activeTabId) return
    const qIdx = url.indexOf('?')
    if (qIdx !== -1) {
      const baseUrl = url.slice(0, qIdx)
      const qs = url.slice(qIdx + 1)
      const newParams = qs.split('&').filter(Boolean).map(pair => {
        const eqIdx = pair.indexOf('=')
        try {
          if (eqIdx === -1) return { key: decodeURIComponent(pair.replace(/\+/g, ' ')), value: '', enabled: true }
          return {
            key: decodeURIComponent(pair.slice(0, eqIdx).replace(/\+/g, ' ')),
            value: decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' ')),
            enabled: true,
          }
        } catch {
          return { key: pair, value: '', enabled: true }
        }
      })
      const existing = snap?.params ?? []
      // Keep disabled params, merge with new enabled params
      const disabled = existing.filter(p => !p.enabled)
      updateSnapshot(activeTabId, { url: baseUrl, params: [...newParams, ...disabled] })
    } else {
      updateSnapshot(activeTabId, { url })
    }
  }

  const tabHasContent: Partial<Record<EditorTab, boolean>> = snap ? {
    params: snap.params.some(p => p.enabled && p.key),
    headers: snap.headers.some(h => h.enabled && h.key),
    body: snap.body.type !== 'none',
    auth: snap.auth.type !== 'none',
    scripts: !!(snap.preRequestScript?.trim() || snap.postRequestScript?.trim()),
    settings: !!(snap.settings),
  } : {}

  const EDITOR_TABS: { key: EditorTab; label: string }[] = [
    { key: 'params', label: t('tabs.params') },
    { key: 'headers', label: t('tabs.headers') },
    { key: 'body', label: t('tabs.body') },
    { key: 'auth', label: t('tabs.auth') },
    { key: 'scripts', label: t('tabs.scripts') },
    { key: 'settings', label: 'Settings' },
    { key: 'variables', label: t('tabs.variables') },
  ]

  // Sliding window: show last maxVisible tabs; shift back if active tab is before window
  const activeIndex = tabs.findIndex(t => t.id === activeTabId)
  let windowStart = Math.max(0, tabs.length - maxVisible)
  if (activeIndex >= 0 && activeIndex < windowStart) windowStart = activeIndex
  const visibleTabs = tabs.slice(windowStart, windowStart + maxVisible)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div ref={tabBarRef} className="flex h-9 shrink-0 items-center border-b border-th-border bg-th-surface">
        {/* Fixed-window tab strip — no scroll, clips to maxVisible */}
        <div className="flex items-center gap-1 overflow-hidden px-1.5 py-1">
          {visibleTabs.map(tab => {
            const tabSnap = snapshots[tab.id]
            const method = tabSnap?.method ?? 'GET'
            const methodColor = METHOD_COLORS[method] ?? 'text-th-fg-muted'
            const isActive = activeTabId === tab.id
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.title}
                style={{ width: tabs.length >= maxVisible ? tabWidth : 120 }}
                className={cn(
                  'group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-th-bg text-th-fg shadow-sm ring-1 ring-inset ring-th-border'
                    : 'text-th-fg-muted hover:bg-th-bg/40 hover:text-th-fg'
                )}
              >
                <span className={cn('shrink-0 text-[10px] font-bold', methodColor)}>{method}</span>
                <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                {tab.isDirty && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-th-accent"
                    title="Unsaved changes — Ctrl+S to save"
                  />
                )}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (tab.isDirty) {
                      if (tab.requestId) {
                        setCloseSaveError(null)
                        setPendingCloseTabId(tab.id)
                      } else {
                        setPendingCloseNewTabId(tab.id)
                      }
                    } else {
                      closeTab(tab.id)
                    }
                  }}
                  className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-th-surface-hover group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>

        {/* + button outside overflow-hidden strip so it's never clipped */}
        <button
          onClick={newTab}
          title="New tab"
          className="shrink-0 rounded-md px-2 py-1.5 text-th-fg-muted transition-colors hover:bg-th-bg/40 hover:text-th-fg"
        >
          <Plus size={13} />
        </button>

        {/* Spacer fills remaining space between strip and right controls */}
        <div className="flex-1" />

        {/* Right controls: ˅ dropdown + env selector */}
        <div ref={rightControlsRef} className="flex shrink-0 items-stretch border-l border-th-border">
          <div className="relative" ref={tabListRef}>
            <button
              onClick={() => { setShowTabList(v => !v); setTabListSearch('') }}
              title="All tabs"
              className={cn(
                'flex h-full items-center px-2 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg',
                showTabList && 'bg-th-surface-hover text-th-fg'
              )}
            >
              <ChevronDown size={13} />
            </button>

            {showTabList && (
              <div className="absolute right-0 top-full z-50 w-72 rounded-b-xl border border-th-border bg-th-surface shadow-xl">
                {/* Search */}
                <div className="flex items-center gap-2 border-b border-th-border px-3 py-2">
                  <Search size={12} className="shrink-0 text-th-fg-muted" />
                  <input
                    autoFocus
                    value={tabListSearch}
                    onChange={e => setTabListSearch(e.target.value)}
                    placeholder="Search tabs"
                    className="min-w-0 flex-1 bg-transparent text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none"
                  />
                </div>
                {/* Tab list */}
                <div className="max-h-72 overflow-y-auto py-1">
                  {tabs
                    .filter(tab => tab.title.toLowerCase().includes(tabListSearch.toLowerCase()))
                    .map(tab => {
                      const tabSnap = snapshots[tab.id]
                      const method = tabSnap?.method ?? 'GET'
                      const methodColor = METHOD_COLORS[method] ?? 'text-th-fg-muted'
                      const isActive = activeTabId === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => { setActiveTab(tab.id); setShowTabList(false) }}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-th-surface-hover',
                            isActive ? 'text-th-fg' : 'text-th-fg-muted'
                          )}
                        >
                          <span className={cn('w-[46px] shrink-0 text-[10px] font-bold', methodColor)}>{method}</span>
                          <span className="min-w-0 flex-1 truncate text-left">{tab.title}</span>
                          {tab.isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-th-accent" />}
                        </button>
                      )
                    })
                  }
                  {tabs.filter(tab => tab.title.toLowerCase().includes(tabListSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-3 text-center text-xs text-th-fg-muted">No tabs found</p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Environment selector */}
          <div className="flex w-52 shrink-0 items-center gap-1.5 border-l border-th-border px-2">
            <div
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                activeEnvironmentId
                  ? 'bg-th-accent shadow-[0_0_4px] shadow-th-accent/50'
                  : 'bg-th-border'
              )}
              title={activeEnvironmentId ? 'Environment active' : 'No environment selected'}
            />
            <select
              value={activeEnvironmentId ?? ''}
              onChange={e => setActiveEnvironment(e.target.value || null)}
              className="min-w-0 flex-1 rounded-lg border border-th-border bg-th-input px-1.5 py-0.5 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            >
              <option value="">{tn('noEnvironment')}</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!snap ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-th-surface-hover text-th-fg-muted">
              <Inbox size={26} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-th-fg">{t('openOrCreate')}</p>
              <p className="max-w-[240px] text-xs text-th-fg-subtle">Open a request from the sidebar or start a new tab to begin testing.</p>
            </div>
            <button
              onClick={newTab}
              className="flex items-center gap-1.5 rounded-md bg-th-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <Plus size={13} />
              {t('newTab')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Request name header with breadcrumb */}
          <div className="flex items-center gap-1.5 border-b border-th-border bg-th-bg px-3 py-1.5">
            {activeCollection && (() => {
              const reqInStore = (storeRequests[activeCollection.id] ?? []).find(r => r.id === activeTab?.requestId)
              const folder = reqInStore?.folderId
                ? (folders[activeCollection.id] ?? []).find(f => f.id === reqInStore.folderId)
                : null
              return (
                <>
                  <span className="max-w-[120px] truncate text-xs text-th-fg-muted">{activeCollection.name}</span>
                  {folder && (
                    <>
                      <span className="text-xs text-th-fg-subtle">/</span>
                      <span className="max-w-[120px] truncate text-xs text-th-fg-muted">{folder.name}</span>
                    </>
                  )}
                  <span className="text-xs text-th-fg-subtle">/</span>
                </>
              )
            })()}
            <input
              type="text"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={confirmNameEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.currentTarget.blur() }
                if (e.key === 'Escape') { setNameDraft(activeTab?.title ?? ''); e.currentTarget.blur() }
              }}
              placeholder="Untitled Request"
              className="max-w-[220px] rounded border border-transparent bg-transparent px-2 py-0.5 text-sm font-medium text-th-fg placeholder:text-th-fg-subtle hover:border-th-border focus:border-th-accent focus:bg-th-input focus:outline-none focus:ring-1 focus:ring-th-accent/50 truncate"
            />
            {activeTab?.isDirty && activeTab.requestId && (
              <button
                onClick={handleRevert}
                title="Revert to last saved state"
                className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
              >
                <RotateCcw size={11} />
                <span>Revert</span>
              </button>
            )}
            {activeTab?.requestId && (
              <button
                onClick={() => setShowVersions(true)}
                title={t('versionsHint')}
                className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
              >
                <History size={11} />
              </button>
            )}
          </div>

          {/* URL bar */}
          <UrlBar
            method={snap.method}
            url={snap.url}
            onMethodChange={method => updateSnapshot(activeTabId!, { method })}
            onUrlChange={handleUrlChange}
            onSend={handleSend}
            sending={snap.sending}
            localScope={snap.localScope}
            environmentVariables={envVars}
            collectionVariables={collectionVars}
            globalVariables={globalVars}
            onSave={handleSave}
            isDirty={activeTab?.isDirty ?? false}
            saving={saving}
            isNewRequest={!activeTab?.requestId}
            onSetLocalVar={(name, value) => onSaveVar('local', name, value)}
            hasCollection={hasCollection}
            hasEnvironment={hasEnvironment}
            collectionName={activeCollection?.name}
            environmentName={activeEnv?.name}
            onNavigateToVariables={() => setEditorTab('variables')}
            onSaveVar={onSaveVar}
            onShowSnippet={() => setShowSnippet(true)}
          />

          {/* Split: request editor + response, stacked (bottom) or side-by-side (right) */}
          <div
            ref={splitContainerRef}
            className={cn(
              'flex flex-1 overflow-hidden',
              responsePosition === 'bottom' ? 'flex-col' : 'flex-row',
              isResizingResponse && 'select-none'
            )}
          >
            {/* Request editor */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ flex: `0 0 ${(1 - responseRatio) * 100}%`, minHeight: responsePosition === 'bottom' ? 100 : undefined, minWidth: responsePosition === 'right' ? 200 : undefined }}
            >
              {/* Editor tab bar */}
              <div className="flex items-center gap-0.5 border-b border-th-border bg-th-surface px-2 py-1">
                {EDITOR_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setEditorTab(key)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-all duration-150',
                      editorTab === key
                        ? 'bg-th-bg text-th-fg shadow-sm'
                        : 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
                    )}
                  >
                    {label}
                    {tabHasContent[key] && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-th-accent" />
                    )}
                  </button>
                ))}
                <button
                  onClick={toggleResponsePosition}
                  title={responsePosition === 'bottom' ? 'Move response panel to the right' : 'Move response panel to the bottom'}
                  className="ml-auto rounded-lg p-1.5 text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
                >
                  {responsePosition === 'bottom' ? <Columns2 size={13} /> : <Rows2 size={13} />}
                </button>
              </div>
              <div className={editorTab === 'body' ? 'flex flex-1 flex-col overflow-hidden' : 'flex-1 overflow-y-auto'}>
                {editorTab === 'params' && (
                  <ParamsTab
                    params={snap.params}
                    onChange={params => updateSnapshot(activeTabId!, { params })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    collectionVariables={collectionVars}
                    globalVariables={globalVars}
                    hasCollection={hasCollection}
                    hasEnvironment={hasEnvironment}
                    collectionName={activeCollection?.name}
                    environmentName={activeEnv?.name}
                    onSaveVar={onSaveVar}
                    onNavigateToVariables={() => setEditorTab('variables')}
                  />
                )}
                {editorTab === 'headers' && (
                  <HeadersTab
                    headers={snap.headers}
                    onChange={headers => updateSnapshot(activeTabId!, { headers })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    collectionVariables={collectionVars}
                    globalVariables={globalVars}
                    hasCollection={hasCollection}
                    hasEnvironment={hasEnvironment}
                    collectionName={activeCollection?.name}
                    environmentName={activeEnv?.name}
                    onSaveVar={onSaveVar}
                    onNavigateToVariables={() => setEditorTab('variables')}
                  />
                )}
                {editorTab === 'body' && (
                  <BodyTab
                    body={snap.body}
                    onChange={body => updateSnapshot(activeTabId!, { body })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    collectionVariables={collectionVars}
                    globalVariables={globalVars}
                    hasCollection={hasCollection}
                    hasEnvironment={hasEnvironment}
                    collectionName={activeCollection?.name}
                    environmentName={activeEnv?.name}
                    onSaveVar={onSaveVar}
                    onNavigateToVariables={() => setEditorTab('variables')}
                  />
                )}
                {editorTab === 'auth' && (
                  <AuthTab
                    auth={snap.auth}
                    onChange={auth => updateSnapshot(activeTabId!, { auth })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    collectionVariables={collectionVars}
                    globalVariables={globalVars}
                    hasCollection={hasCollection}
                    hasEnvironment={hasEnvironment}
                    collectionName={activeCollection?.name}
                    environmentName={activeEnv?.name}
                    onSaveVar={onSaveVar}
                    onNavigateToVariables={() => setEditorTab('variables')}
                    onLocalScopeSet={(key, value) => updateSnapshot(activeTabId!, {
                      localScope: { ...(snapshots[activeTabId!]?.localScope ?? {}), [key]: value },
                    })}
                  />
                )}
                {editorTab === 'scripts' && (
                  <ScriptsTab
                    preRequestScript={snap.preRequestScript}
                    postRequestScript={snap.postRequestScript}
                    onPreChange={v => updateSnapshot(activeTabId!, { preRequestScript: v })}
                    onPostChange={v => updateSnapshot(activeTabId!, { postRequestScript: v })}
                  />
                )}
                {editorTab === 'settings' && (
                  <SettingsTab
                    settings={activeSettings}
                    onChange={settings => updateSnapshot(activeTabId!, { settings })}
                  />
                )}
                {editorTab === 'variables' && (
                  <VariablesPanel
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    collectionVariables={collectionVars}
                    globalVariables={globalVars}
                    url={snap.url}
                    headers={snap.headers}
                    params={snap.params}
                    auth={snap.auth}
                  />
                )}
              </div>
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={e => { e.preventDefault(); setIsResizingResponse(true) }}
              className={cn(
                'group relative shrink-0',
                responsePosition === 'bottom' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'
              )}
            >
              <div className={cn(
                'absolute transition-colors',
                responsePosition === 'bottom'
                  ? 'inset-x-0 top-1/2 h-px -translate-y-1/2'
                  : 'inset-y-0 left-1/2 w-px -translate-x-1/2',
                isResizingResponse ? 'bg-th-accent' : 'bg-th-border group-hover:bg-th-accent'
              )} />
            </div>
            {/* Response panel */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ flex: `0 0 ${responseRatio * 100}%`, minHeight: responsePosition === 'bottom' ? 100 : undefined, minWidth: responsePosition === 'right' ? 200 : undefined }}
            >
              {snap.response ? (
                <ResponsePanel response={snap.response} requestId={activeTab?.requestId} requestName={activeTab?.title} responseKey={responseKey} />
              ) : snap.sending ? (
                <ResponseLoadingSkeleton />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-th-fg-subtle">
                  {t('emptyState')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unsaved-changes confirmation dialog (saved request, dirty) */}
      {pendingCloseTabId && (() => {
        const pendingTab = tabs.find(t => t.id === pendingCloseTabId)
        return (
          <UnsavedChangesDialog
            tabTitle={pendingTab?.title ?? ''}
            saving={closeSaving}
            saveError={closeSaveError}
            onCancel={() => setPendingCloseTabId(null)}
            onDiscard={() => { closeTab(pendingCloseTabId); setPendingCloseTabId(null) }}
            onSave={async () => {
              setCloseSaving(true)
              setCloseSaveError(null)
              try {
                await saveRequest(pendingCloseTabId)
                // Sync fresh data into CollectionStore so sidebar reopens with latest values
                const { tabs: ft, snapshots: fs } = useRequestStore.getState()
                const ft2 = ft.find(t => t.id === pendingCloseTabId)
                const fs2 = fs[pendingCloseTabId]
                if (ft2?.requestId && ft2.collectionId && fs2) {
                  patchRequest(ft2.requestId, ft2.collectionId, {
                    name: ft2.title,
                    method: fs2.method,
                    url: fs2.url,
                    params: fs2.params,
                    headers: fs2.headers,
                    body: fs2.body,
                    auth: fs2.auth,
                    preRequestScript: fs2.preRequestScript,
                    postRequestScript: fs2.postRequestScript,
                  })
                }
                closeTab(pendingCloseTabId)
                setPendingCloseTabId(null)
              } catch (err) {
                setCloseSaveError(err instanceof Error ? err.message : 'Save failed')
              } finally {
                setCloseSaving(false)
              }
            }}
          />
        )
      })()}

      {/* Close-confirmation for new (unsaved) tabs with content */}
      {pendingCloseNewTabId && (() => {
        const pendingTab = tabs.find(t => t.id === pendingCloseNewTabId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
              <div className="flex items-center gap-2 border-b border-th-border px-5 py-3">
                <p className="text-sm font-semibold">{t('newTabDialog.title')}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-th-fg-muted">
                  {t('newTabDialog.message', { name: pendingTab?.title ?? '' })}
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-th-border px-5 py-3">
                <button
                  onClick={() => setPendingCloseNewTabId(null)}
                  className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
                >
                  {t('newTabDialog.cancel')}
                </button>
                <button
                  onClick={() => { closeTab(pendingCloseNewTabId); setPendingCloseNewTabId(null) }}
                  className="rounded-md border border-th-border px-3 py-1.5 text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover"
                >
                  {t('newTabDialog.dontSave')}
                </button>
                <button
                  onClick={() => {
                    const tabId = pendingCloseNewTabId
                    setPendingCloseNewTabId(null)
                    setSaveModalForTabId(tabId)
                  }}
                  className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  {t('newTabDialog.save')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Save-to-collection modal for new requests */}
      {saveModalForTabId && (() => {
        const modalTab = tabs.find(t => t.id === saveModalForTabId)
        const modalSnap = snapshots[saveModalForTabId]
        if (!modalTab || !modalSnap) return null
        return (
          <SaveRequestModal
            initialName={modalTab.title}
            snapshot={modalSnap}
            onClose={() => setSaveModalForTabId(null)}
            onSaved={(requestId, collectionId, _folderId, savedName) => {
              const tabId = saveModalForTabId
              // Stamp the tab with its DB identity + name in one atomic update (no dirty flag)
              attachRequest(tabId, requestId, collectionId, savedName)
              // Sync the header name input
              setNameDraft(savedName)
              // Refresh sidebar for this collection
              fetchRequests(collectionId)
              // If this save was triggered by closing a tab, close it now
              if (pendingCloseNewTabId === tabId) {
                closeTab(tabId)
                setPendingCloseNewTabId(null)
              }
              setSaveModalForTabId(null)
            }}
          />
        )
      })()}

      {showSnippet && snap && (
        <CodeSnippetModal
          input={{
            method: snap.method,
            url: snap.url,
            params: snap.params,
            headers: snap.headers,
            body: snap.body,
            auth: snap.auth,
          }}
          onClose={() => setShowSnippet(false)}
        />
      )}

      {showVersions && activeTab?.requestId && snap && (
        <RequestVersionsPanel
          requestId={activeTab.requestId}
          snapshot={snap}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  )
}
