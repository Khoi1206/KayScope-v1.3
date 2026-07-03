'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Trash2 } from 'lucide-react'
import { useWorkspaceStore, type WorkspaceRole } from '@/store/workspace.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import ConfirmModal from '@/components/ConfirmModal'

interface Props {
  workspaceId: string
  workspaceName: string
  onClose: () => void
}

const ROLES: WorkspaceRole[] = ['admin', 'editor', 'viewer']

export default function WorkspaceMembersModal({ workspaceId, workspaceName, onClose }: Props) {
  const t = useTranslations('workspace')
  const { members, fetchMembers, inviteMember, updateMemberRole, removeMember } = useWorkspaceStore()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('editor')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null)

  useEscapeKey(onClose)
  useEffect(() => { void fetchMembers(workspaceId) }, [workspaceId, fetchMembers])

  function roleLabel(r: WorkspaceRole) {
    if (r === 'admin') return t('members.roleAdmin')
    if (r === 'editor') return t('members.roleEditor')
    return t('members.roleViewer')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    try {
      await inviteMember(workspaceId, email.trim(), role)
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: WorkspaceRole) {
    setError(null)
    try {
      await updateMemberRole(workspaceId, userId, newRole)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleConfirmRemove() {
    if (!confirmRemove) return
    setError(null)
    try {
      await removeMember(workspaceId, confirmRemove.userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setConfirmRemove(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="flex h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-th-border bg-th-bg shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-th-border px-5 py-3">
            <div>
              <p className="text-xs text-th-fg-muted">{t('members.title')}</p>
              <p className="text-sm font-semibold text-th-fg">{workspaceName}</p>
            </div>
            <button onClick={onClose} className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg">
              <X size={15} />
            </button>
          </div>

          <form onSubmit={handleInvite} className="flex shrink-0 items-center gap-2 border-b border-th-border px-5 py-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('members.inviteEmailPlaceholder')}
              className="flex-1 rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-1 focus:ring-th-accent"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as WorkspaceRole)}
              className="rounded border border-th-border bg-th-input px-2 py-1.5 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
            >
              {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="rounded bg-th-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-th-accent-hover disabled:opacity-50"
            >
              {inviting ? t('members.inviting') : t('members.invite')}
            </button>
          </form>

          {error && (
            <p className="shrink-0 bg-red-500/10 px-5 py-2 text-xs text-red-400">{error}</p>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {members.length === 0 ? (
              <p className="text-xs text-th-fg-subtle">{t('members.empty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-md border border-th-border bg-th-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-th-fg">{m.userName}</p>
                      <p className="truncate text-[11px] text-th-fg-subtle">{m.userEmail}</p>
                    </div>
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                      className="rounded border border-th-border bg-th-input px-2 py-1 text-xs text-th-fg focus:outline-none focus:ring-1 focus:ring-th-accent"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                    <button
                      onClick={() => setConfirmRemove({ userId: m.userId, name: m.userName })}
                      title={t('members.remove')}
                      className="flex shrink-0 items-center rounded p-1 text-th-fg-muted hover:bg-th-surface-hover hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmRemove && (
        <ConfirmModal
          title={t('members.removeConfirmTitle')}
          message={t('members.removeConfirmMessage', { name: confirmRemove.name })}
          confirmLabel={t('members.removeConfirmLabel')}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </>
  )
}
