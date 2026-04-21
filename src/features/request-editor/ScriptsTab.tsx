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
    <div className="flex flex-col">
      {/* Tab strip */}
      <div className="flex border-b border-th-border px-3">
        {(['pre', 'post'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveScript(tab)}
            className={cn(
              'relative px-3 py-2 text-xs font-medium transition-colors',
              activeScript === tab
                ? 'text-th-fg after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-th-accent'
                : 'text-th-fg-muted hover:text-th-fg'
            )}
          >
            {tab === 'pre' ? t('preRequest') : t('postRequest')}
          </button>
        ))}
      </div>

      <div className="p-3">
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
          Use <code className="text-th-fg">pm.variables</code>, <code className="text-th-fg">pm.environment</code>, <code className="text-th-fg">pm.test()</code>
        </p>
      </div>
    </div>
  )
}
