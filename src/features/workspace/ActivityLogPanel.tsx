'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface Props {
  workspaceId: string
  workspaceName: string
  onClose: () => void
}

export default function ActivityLogPanel({ workspaceId, workspaceName, onClose }: Props) {
  const t = useTranslations('workspace')
  const { activityLogs, fetchActivityLogs } = useWorkspaceStore()

  useEscapeKey(onClose)
  useEffect(() => { void fetchActivityLogs(workspaceId) }, [workspaceId, fetchActivityLogs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
          <div>
            <p className="text-xs text-th-fg-muted">{t('activity.title')}</p>
            <p className="text-sm font-semibold text-th-fg">{workspaceName}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activityLogs.length === 0 ? (
            <p className="text-xs text-th-fg-subtle">{t('activity.empty')}</p>
          ) : (
            <div className="rounded-md border border-th-border overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {activityLogs.map(log => (
                    <tr key={log.id} className="border-t border-th-border/50 first:border-t-0 hover:bg-th-surface-hover">
                      <td className="px-3 py-2 text-th-fg">
                        {t('activity.entry', {
                          action: t(`activity.action_${log.action}`),
                          entityType: t(`activity.entity_${log.entityType}`),
                          entityName: log.entityName,
                        })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-th-fg-muted">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
