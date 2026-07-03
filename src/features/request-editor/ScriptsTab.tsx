'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import MonacoEditor from '@/components/MonacoEditor'
import { cn } from '@/components/ui/cn'

interface Props {
  preRequestScript: string
  postRequestScript: string
  onPreChange: (v: string) => void
  onPostChange: (v: string) => void
}

type ScriptTab = 'pre' | 'post'

interface Snippet {
  label: string
  code: string
}

const PRE_SNIPPETS: Snippet[] = [
  {
    label: 'Set variable',
    code: 'pm.variables.set("key", "value");',
  },
  {
    label: 'Set env variable',
    code: 'pm.environment.set("key", "value");',
  },
  {
    label: 'Get variable',
    code: 'const val = pm.variables.get("key");',
  },
  {
    label: 'Set header',
    code: 'pm.request.setHeader("X-Custom-Header", "value");',
  },
  {
    label: 'Set body (JSON)',
    code: 'pm.request.setBody(JSON.stringify({ key: "value" }));',
  },
  {
    label: 'Generate random ID',
    code: 'pm.variables.set("randomId", pm.variables.replaceIn("{{$guid}}"));',
  },
]

const POST_SNIPPETS: Snippet[] = [
  {
    label: 'Status code 200',
    code: 'pm.test("Status is 200", () => {\n  pm.expect(pm.response.status).to.equal(200);\n});',
  },
  {
    label: 'Status code 201',
    code: 'pm.test("Status is 201", () => {\n  pm.expect(pm.response.status).to.equal(201);\n});',
  },
  {
    label: 'Response time < 500ms',
    code: 'pm.test("Response time < 500ms", () => {\n  pm.expect(pm.response.responseTime).to.be.within(0, 500);\n});',
  },
  {
    label: 'Parse JSON body',
    code: 'const json = JSON.parse(pm.response.body);\nconsole.log(json);',
  },
  {
    label: 'Save field to variable',
    code: 'const json = JSON.parse(pm.response.body);\npm.environment.set("token", json.token);',
  },
  {
    label: 'Body contains string',
    code: 'pm.test("Body contains string", () => {\n  pm.expect(pm.response.body).to.include("expected");\n});',
  },
  {
    label: 'JSON field equals',
    code: 'pm.test("Field equals value", () => {\n  const json = JSON.parse(pm.response.body);\n  pm.expect(json.field).to.equal("value");\n});',
  },
  {
    label: 'Header present',
    code: 'pm.test("Has content-type", () => {\n  pm.expect(pm.response.headers["content-type"]).to.include("application/json");\n});',
  },
]

export default function ScriptsTab({ preRequestScript, postRequestScript, onPreChange, onPostChange }: Props) {
  const t = useTranslations('tabs')
  const [activeScript, setActiveScript] = useState<ScriptTab>('pre')

  const snippets = activeScript === 'pre' ? PRE_SNIPPETS : POST_SNIPPETS
  const currentValue = activeScript === 'pre' ? preRequestScript : postRequestScript
  const onChange = activeScript === 'pre' ? onPreChange : onPostChange

  function insertSnippet(code: string) {
    const current = currentValue?.trim() ?? ''
    onChange(current ? `${current}\n\n${code}` : code)
  }

  return (
    <div className="flex flex-col">
      {/* Script type tab strip */}
      <div className="flex items-center gap-0.5 border-b border-th-border bg-th-surface px-2 py-1">
        {(['pre', 'post'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveScript(tab)}
            className={cn(
              'rounded-lg px-3 py-1 text-xs font-medium transition-all duration-150',
              activeScript === tab
                ? 'bg-th-bg text-th-fg shadow-sm'
                : 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
            )}
          >
            {tab === 'pre' ? t('preRequest') : t('postRequest')}
          </button>
        ))}
      </div>

      {/* Split: editor left, snippets right */}
      <div className="flex">
        {/* Editor */}
        <div className="min-w-0 flex-1 p-3">
          {activeScript === 'pre' && (
            <MonacoEditor
              value={preRequestScript}
              onChange={onPreChange}
              language="javascript"
              height="200px"
            />
          )}
          {activeScript === 'post' && (
            <MonacoEditor
              value={postRequestScript}
              onChange={onPostChange}
              language="javascript"
              height="200px"
            />
          )}
          <p className="mt-2 text-xs text-th-fg-subtle">
            Use{' '}
            <code className="text-th-fg">pm.variables</code>,{' '}
            <code className="text-th-fg">pm.environment</code>,{' '}
            <code className="text-th-fg">pm.test()</code>,{' '}
            <code className="text-th-fg">pm.expect()</code>
          </p>
        </div>

        {/* Snippets panel */}
        <div className="w-44 shrink-0 border-l border-th-border">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-th-fg-subtle">
            Snippets
          </p>
          <div className="flex flex-col">
            {snippets.map((s, i) => (
              <button
                key={i}
                onClick={() => insertSnippet(s.code)}
                title={s.code}
                className="flex w-full items-center justify-between gap-1 px-3 py-1.5 text-left text-xs text-th-fg-muted transition-colors hover:bg-th-surface-hover hover:text-th-fg"
              >
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <ChevronRight size={10} className="shrink-0 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
