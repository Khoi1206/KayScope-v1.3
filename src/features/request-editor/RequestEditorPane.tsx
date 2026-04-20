'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Plus } from 'lucide-react'
import { useRequestStore } from '@/store/request.store'
import { useEnvironmentStore } from '@/store/environment.store'
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
  const { environments, activeEnvironmentId, setActiveEnvironment } = useEnvironmentStore()
  const [editorTab, setEditorTab] = useState<EditorTab>('params')
  const [saving, setSaving] = useState(false)

  const activeEnv = environments.find(e => e.id === activeEnvironmentId)
  const envVars = Object.fromEntries(
    (activeEnv?.variables ?? [])
      .filter(v => v.enabled)
      .map(v => [v.key, v.value])
  )

  const snap = activeTabId ? snapshots[activeTabId] : null
  const activeTab = activeTabId ? tabs.find(t => t.id === activeTabId) : null

  function newTab() {
    openTab({ id: nanoidLocal(), title: t('newTab') })
  }

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
      // silent — could show a toast here
    } finally {
      setSaving(false)
    }
  }

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
      <div className="flex items-center gap-0 border-b border-th-border bg-th-surface px-2 pt-1">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-t border-b-2 px-3 py-1.5 text-xs',
              activeTabId === tab.id
                ? 'border-th-accent bg-th-bg text-th-fg'
                : 'border-transparent text-th-fg-muted hover:text-th-fg'
            )}
          >
            <span className="max-w-32 truncate">{tab.title}</span>
            {tab.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-th-accent" />}
            <button
              onClick={e => { e.stopPropagation(); closeTab(tab.id) }}
              className="rounded p-0.5 hover:bg-th-surface-hover"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          onClick={newTab}
          className="ml-1 rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
        >
          <Plus size={14} />
        </button>
      </div>

      {!snap ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-3 text-sm text-th-fg-muted">{t('openOrCreate')}</p>
            <button
              onClick={newTab}
              className="rounded bg-th-accent px-4 py-2 text-sm text-white hover:bg-th-accent-hover"
            >
              {t('newTab')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Environment selector */}
          <div className="flex items-center gap-2 border-b border-th-border bg-th-surface px-4 py-1.5">
            <span className="shrink-0 text-xs text-th-fg-muted">{tn('environments')}:</span>
            <select
              value={activeEnvironmentId ?? ''}
              onChange={e => setActiveEnvironment(e.target.value || null)}
              className="rounded border border-th-border bg-th-input px-2 py-0.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
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
            onSave={activeTab?.requestId ? handleSave : undefined}
            isDirty={activeTab?.isDirty ?? false}
            saving={saving}
            onSetLocalVar={(name, value) =>
              updateSnapshot(activeTabId!, {
                localScope: { ...snap.localScope, [name]: value },
              })
            }
          />

          {/* Request / Response split */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Editor tab bar */}
            <div className="flex gap-0 border-b border-th-border bg-th-surface px-4">
              {EDITOR_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setEditorTab(key)}
                  className={cn(
                    'px-3 py-2 text-xs',
                    editorTab === key
                      ? 'border-b-2 border-th-accent text-th-fg'
                      : 'text-th-fg-muted hover:text-th-fg'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab pane + Response panel (always visible) */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {editorTab === 'params' && (
                  <ParamsTab
                    params={snap.params}
                    onChange={params => updateSnapshot(activeTabId!, { params })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    onSetLocalVar={(name, value) => updateSnapshot(activeTabId!, { localScope: { ...snap.localScope, [name]: value } })}
                  />
                )}
                {editorTab === 'headers' && (
                  <HeadersTab
                    headers={snap.headers}
                    onChange={headers => updateSnapshot(activeTabId!, { headers })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
                    onSetLocalVar={(name, value) => updateSnapshot(activeTabId!, { localScope: { ...snap.localScope, [name]: value } })}
                  />
                )}
                {editorTab === 'body' && (
                  <BodyTab
                    body={snap.body}
                    onChange={body => updateSnapshot(activeTabId!, { body })}
                    localScope={snap.localScope}
                    environmentVariables={envVars}
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
                    url={snap.url}
                    headers={snap.headers}
                    params={snap.params}
                  />
                )}
              </div>

              {/* Response panel — always shown, empty state before first send */}
              <div className="w-1/2 border-l border-th-border">
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
        </div>
      )}
    </div>
  )
}
