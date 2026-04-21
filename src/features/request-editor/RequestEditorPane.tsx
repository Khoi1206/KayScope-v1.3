'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus } from 'lucide-react'
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
  } = useRequestStore()
  const { environments, activeEnvironmentId, setActiveEnvironment, updateEnvironment } = useEnvironmentStore()
  const { workspace, updateGlobalVariables } = useWorkspaceStore()
  const { collections, updateCollection } = useCollectionStore()
  const [editorTab, setEditorTab] = useState<EditorTab>('params')
  const [saving, setSaving] = useState(false)
  const handleSaveRef = useRef<() => void>(() => {})

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

  // Merged for UI preview: global < collection < env (local is kept separate — wins at render time)
  const previewVars = { ...globalVars, ...collectionVars, ...envVars }

  const snap = activeTabId ? snapshots[activeTabId] : null

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
      await saveRequest(activeTabId)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  // Keep ref in sync so Ctrl+S always calls the latest handleSave
  handleSaveRef.current = handleSave

  const EDITOR_TABS: { key: EditorTab; label: string }[] = [
    { key: 'params', label: t('tabs.params') },
    { key: 'headers', label: t('tabs.headers') },
    { key: 'body', label: t('tabs.body') },
    { key: 'auth', label: t('tabs.auth') },
    { key: 'scripts', label: t('tabs.scripts') },
    { key: 'variables', label: t('tabs.variables') },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-th-border bg-th-surface">
        <div
          className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map(tab => {
            const tabSnap = snapshots[tab.id]
            const method = tabSnap?.method ?? 'GET'
            const methodColor = METHOD_COLORS[method] ?? 'text-th-fg-muted'
            const isActive = activeTabId === tab.id
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-th-border px-3 py-2.5 text-xs transition-colors',
                  isActive
                    ? 'bg-th-bg text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                    : 'text-th-fg-muted hover:bg-th-bg/50 hover:text-th-fg'
                )}
              >
                <span className={cn('text-[10px] font-bold', methodColor)}>{method}</span>
                <span className="max-w-24 truncate">{tab.title}</span>
                {tab.isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-th-accent" />}
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-th-surface-hover group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
          {/* New tab button — sits right after the last tab */}
          <button
            onClick={newTab}
            title="New tab"
            className="shrink-0 px-2.5 py-2 text-th-fg-subtle transition-colors hover:bg-th-bg/50 hover:text-th-fg"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {!snap ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-3 text-sm text-th-fg-muted">{t('openOrCreate')}</p>
            <button
              onClick={newTab}
              className="rounded-md bg-th-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('newTab')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Environment selector */}
          <div className="flex items-center gap-2 border-b border-th-border bg-th-surface px-4 py-1.5">
            <span className="shrink-0 text-[11px] font-medium text-th-fg-muted">{tn('environments')}:</span>
            <select
              value={activeEnvironmentId ?? ''}
              onChange={e => setActiveEnvironment(e.target.value || null)}
              className="rounded-md border border-th-border bg-th-input px-2 py-0.5 text-xs text-th-fg transition-colors focus:border-th-accent focus:outline-none focus:ring-1 focus:ring-th-accent/50"
            >
              <option value="">{tn('noEnvironment')}</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
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
            onSetLocalVar={(name, value) =>
              updateSnapshot(activeTabId!, {
                localScope: { ...snap.localScope, [name]: value },
              })
            }
            hasCollection={!!activeTab?.collectionId}
            hasEnvironment={!!activeEnvironmentId}
            collectionName={activeCollection?.name}
            environmentName={activeEnv?.name}
            onNavigateToVariables={() => setEditorTab('variables')}
            onSaveVar={async (scope, name, value) => {
              if (scope === 'collection' && activeTab?.collectionId) {
                const col = collections.find(c => c.id === activeTab!.collectionId)
                if (!col) throw new Error('Collection not found')
                const existing = col.variables ?? []
                const idx = existing.findIndex(v => v.key === name)
                const newVars = idx >= 0
                  ? existing.map((v, i) => i === idx ? { ...v, value } : v)
                  : [...existing, { key: name, value, enabled: true }]
                await updateCollection(activeTab!.collectionId!, { variables: newVars })
              } else if (scope === 'environment' && activeEnvironmentId) {
                const env = environments.find(e => e.id === activeEnvironmentId)
                if (!env) throw new Error('Environment not found')
                const existing = env.variables ?? []
                const idx = existing.findIndex(v => v.key === name)
                const newVars = idx >= 0
                  ? existing.map((v, i) => i === idx ? { ...v, value } : v)
                  : [...existing, { key: name, value, enabled: true }]
                await updateEnvironment(activeEnvironmentId, { variables: newVars })
              } else if (scope === 'global') {
                if (!workspace) throw new Error('Workspace not loaded')
                const existing = workspace.globalVariables ?? []
                const idx = existing.findIndex(v => v.key === name)
                const newVars = idx >= 0
                  ? existing.map((v, i) => i === idx ? { ...v, value } : v)
                  : [...existing, { key: name, value, enabled: true }]
                await updateGlobalVariables(newVars)
              } else {
                throw new Error(`Cannot save: scope '${scope}' is not available`)
              }
              // After saving to a persistent scope, evict the local override so the saved scope wins
              if (activeTabId && name in (snapshots[activeTabId]?.localScope ?? {})) {
                const newLocal = { ...snapshots[activeTabId].localScope }
                delete newLocal[name]
                updateSnapshot(activeTabId, { localScope: newLocal })
              }
            }}
          />

          {/* Context bar: collection badge + variables navigation */}
          <div className="flex items-center border-b border-th-border bg-th-surface px-4 py-1">
            <div className="flex-1">
              {activeCollection && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-orange-500/20 text-orange-300">
                  <span className="font-bold">C</span>
                  <span>{activeCollection.name}</span>
                </span>
              )}
            </div>
            <button
              onClick={() => setEditorTab('variables')}
              className="text-[11px] text-th-fg-muted transition-colors hover:text-th-accent"
            >
              Variables in request →
            </button>
          </div>

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
                      'relative px-3 py-2.5 text-xs font-medium transition-colors',
                      editorTab === key
                        ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                        : 'text-th-fg-muted hover:text-th-fg'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {editorTab === 'params' && (
                  <ParamsTab
                    params={snap.params}
                    onChange={params => updateSnapshot(activeTabId!, { params })}
                    localScope={snap.localScope}
                    environmentVariables={previewVars}
                    onSetLocalVar={(name, value) => updateSnapshot(activeTabId!, { localScope: { ...snap.localScope, [name]: value } })}
                  />
                )}
                {editorTab === 'headers' && (
                  <HeadersTab
                    headers={snap.headers}
                    onChange={headers => updateSnapshot(activeTabId!, { headers })}
                    localScope={snap.localScope}
                    environmentVariables={previewVars}
                    onSetLocalVar={(name, value) => updateSnapshot(activeTabId!, { localScope: { ...snap.localScope, [name]: value } })}
                  />
                )}
                {editorTab === 'body' && (
                  <BodyTab
                    body={snap.body}
                    onChange={body => updateSnapshot(activeTabId!, { body })}
                    localScope={snap.localScope}
                    environmentVariables={previewVars}
                    onSetLocalVar={(name, value) => updateSnapshot(activeTabId!, { localScope: { ...snap.localScope, [name]: value } })}
                  />
                )}
                {editorTab === 'auth' && (
                  <AuthTab
                    auth={snap.auth}
                    onChange={auth => updateSnapshot(activeTabId!, { auth })}
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
