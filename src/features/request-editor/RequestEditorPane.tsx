'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus, ChevronDown, Search } from 'lucide-react'
import { useRequestStore } from '@/store/request.store'
import { useEnvironmentStore } from '@/store/environment.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useCollectionStore } from '@/store/collection.store'
import { cn } from '@/components/ui/cn'
import UrlBar from './UrlBar'
import ParamsTab from './ParamsTab'
import HeadersTab from './HeadersTab'
import BodyTab from './BodyTab'
import AuthTab from './AuthTab'
import ScriptsTab from './ScriptsTab'
import ResponsePanel from '@/features/response-viewer/ResponsePanel'
import VariablesPanel from '@/features/variables/VariablesPanel'
import { toServerScopes } from '@/core/interpolation/scope'

type EditorTab = 'params' | 'headers' | 'body' | 'auth' | 'scripts' | 'variables'

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
  } = useRequestStore()
  const { environments, activeEnvironmentId, setActiveEnvironment, updateEnvironment } = useEnvironmentStore()
  const { workspace, updateGlobalVariables } = useWorkspaceStore()
  const { collections, folders, requests: storeRequests, updateCollection, renameRequest, patchRequest } = useCollectionStore()
  const [editorTab, setEditorTab] = useState<EditorTab>('params')
  const [saving, setSaving] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [showTabList, setShowTabList] = useState(false)
  const [tabListSearch, setTabListSearch] = useState('')
  const [maxVisible, setMaxVisible] = useState(7)
  const handleSaveRef = useRef<() => void>(() => {})
  const tabListRef = useRef<HTMLDivElement>(null)
  const tabBarRef = useRef<HTMLDivElement>(null)
  const rightControlsRef = useRef<HTMLDivElement>(null)

  // Measure tab bar width → compute how many tabs fit
  useEffect(() => {
    const bar = tabBarRef.current
    if (!bar) return
    const check = () => {
      const right = rightControlsRef.current
      const MIN_TAB_W = 124 // w-[120px] (120px) + gap-1 (4px)
      const PLUS_BTN = 36
      const PAD = 12 // px-1.5 × 2 sides
      const available = bar.clientWidth - (right?.clientWidth ?? 200) - PAD - PLUS_BTN
      setMaxVisible(Math.max(1, Math.floor(available / MIN_TAB_W)))
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

  function newTab() {
    openTab({ id: nanoidLocal(), title: t('newTab') })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRef.current()
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

      const payload = {
        method: snap.method,
        url: snap.url,
        params: snap.params.filter(p => p.enabled && p.key),
        headers: snap.headers.filter(h => h.enabled && h.key),
        body: snap.body.type !== 'none' ? snap.body : undefined,
        auth: snap.auth.type !== 'none' ? snap.auth : undefined,
        preRequestScript: snap.preRequestScript || undefined,
        postRequestScript: snap.postRequestScript || undefined,
        workspaceId: '__workspace__',
        environmentId: activeEnvironmentId ?? undefined,
        collectionId: activeTab?.collectionId ?? undefined,
        requestId: activeTab?.requestId ?? undefined,
        scopes: serverScopes,
      }

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    }
  }

  async function handleSave() {
    if (!activeTabId) return
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
        patchRequest(freshTab.requestId, freshTab.collectionId, { method: freshSnap.method, name: freshTab.title })
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  // Keep ref in sync so Ctrl+S always calls the latest handleSave
  handleSaveRef.current = handleSave

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

  const tabHasContent: Partial<Record<EditorTab, boolean>> = snap ? {
    params: snap.params.some(p => p.enabled && p.key),
    headers: snap.headers.some(h => h.enabled && h.key),
    body: snap.body.type !== 'none',
    auth: snap.auth.type !== 'none',
    scripts: !!(snap.preRequestScript?.trim() || snap.postRequestScript?.trim()),
  } : {}

  const EDITOR_TABS: { key: EditorTab; label: string }[] = [
    { key: 'params', label: t('tabs.params') },
    { key: 'headers', label: t('tabs.headers') },
    { key: 'body', label: t('tabs.body') },
    { key: 'auth', label: t('tabs.auth') },
    { key: 'scripts', label: t('tabs.scripts') },
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
      <div ref={tabBarRef} className="flex items-center border-b border-th-border bg-th-surface">
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
                className={cn(
                  'group relative flex w-[120px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-th-bg text-th-fg shadow-sm ring-1 ring-inset ring-th-border'
                    : 'text-th-fg-muted hover:bg-th-bg/40 hover:text-th-fg'
                )}
              >
                <span className={cn('shrink-0 text-[10px] font-bold', methodColor)}>{method}</span>
                <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                {tab.isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-th-accent" />}
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
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
                'flex h-full items-center px-2 text-th-fg-muted transition-colors hover:bg-th-bg/50 hover:text-th-fg',
                showTabList && 'bg-th-bg text-th-fg'
              )}
            >
              <ChevronDown size={13} />
            </button>

            {showTabList && (
              <div className="absolute right-0 top-full z-50 w-72 rounded-b-md border border-th-border bg-th-surface shadow-lg">
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
          <div className="flex w-52 shrink-0 items-center border-l border-th-border px-2">
            <select
              value={activeEnvironmentId ?? ''}
              onChange={e => setActiveEnvironment(e.target.value || null)}
              className="w-full rounded border border-th-border bg-th-input px-1.5 py-0.5 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
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
          <div className="text-center">
            <p className="mb-2 text-xs text-th-fg-muted">{t('openOrCreate')}</p>
            <button
              onClick={newTab}
              className="rounded bg-th-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('newTab')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Request name header with breadcrumb */}
          <div className="flex items-center gap-1.5 border-b border-th-border bg-th-surface px-3 py-1.5">
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
          </div>

          {/* URL bar */}
          <UrlBar
            method={snap.method}
            url={snap.url}
            onMethodChange={method => updateSnapshot(activeTabId!, { method })}
            onUrlChange={url => updateSnapshot(activeTabId!, { url })}
            onSend={handleSend}
            sending={snap.sending}
            localScope={snap.localScope}
            environmentVariables={envVars}
            collectionVariables={collectionVars}
            globalVariables={globalVars}
            onSave={activeTab?.requestId ? handleSave : undefined}
            isDirty={activeTab?.isDirty ?? false}
            saving={saving}
            onSetLocalVar={(name, value) => onSaveVar('local', name, value)}
            hasCollection={hasCollection}
            hasEnvironment={hasEnvironment}
            collectionName={activeCollection?.name}
            environmentName={activeEnv?.name}
            onNavigateToVariables={() => setEditorTab('variables')}
            onSaveVar={onSaveVar}
          />

          {/* Vertical split: request editor top, response bottom */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Request editor (top ~60%) */}
            <div className="flex flex-col overflow-hidden" style={{ flex: '0 0 60%', minHeight: 160 }}>
              {/* Editor tab bar */}
              <div className="flex gap-0 border-b border-th-border bg-th-surface px-3">
                {EDITOR_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setEditorTab(key)}
                    className={cn(
                      'relative px-3 py-2 text-xs font-medium transition-colors',
                      editorTab === key
                        ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                        : 'text-th-fg-muted hover:text-th-fg'
                    )}
                  >
                    <span className="relative inline-flex items-center gap-1">
                      {label}
                      {tabHasContent[key] && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-th-accent" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
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

            {/* Response panel (bottom ~40%) */}
            <div className="flex flex-col overflow-hidden border-t border-th-border" style={{ flex: '0 0 40%', minHeight: 140 }}>
              {snap.response ? (
                <ResponsePanel response={snap.response} />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-th-fg-subtle">
                  {t('emptyState')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
