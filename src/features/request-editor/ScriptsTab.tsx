'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import MonacoEditor from '@/components/MonacoEditor'
import { cn } from '@/components/ui/cn'

interface Props {
  preRequestScript: string
  postRequestScript: string
  onPreChange: (v: string) => void
  onPostChange: (v: string) => void
}

type ScriptTab = 'pre' | 'post'

export default function ScriptsTab({ preRequestScript, postRequestScript, onPreChange, onPostChange }: Props) {
  const t = useTranslations('tabs')
  const [activeScript, setActiveScript] = useState<ScriptTab>('pre')

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex gap-1">
        {(['pre', 'post'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveScript(tab)}
            className={cn(
              'rounded px-3 py-0.5 text-xs',
              activeScript === tab
                ? 'bg-th-accent text-white'
                : 'border border-th-border text-th-fg-muted hover:text-th-fg'
            )}
          >
            {tab === 'pre' ? t('preRequest') : t('postRequest')}
          </button>
        ))}
      </div>

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

      <p className="text-xs text-th-fg-subtle">
        Use <code className="text-th-fg">pm.variables</code>, <code className="text-th-fg">pm.environment</code>, <code className="text-th-fg">pm.test()</code>
      </p>
    </div>
  )
}
