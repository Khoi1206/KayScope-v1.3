'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Trash2,
  Pencil,
  Plus,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import AdminUserWorkspacesModal from './AdminUserWorkspacesModal'
import AdminDeleteUserModal from './AdminDeleteUserModal'
import AdminUserModal from './AdminUserModal'

export interface AdminUserRow {
  id: string
  name: string
  email: string
  isAdmin: boolean
  isActive: boolean
  provider: string
  createdAt: string
}

const PAGE_SIZE = 10

export default function AdminUsersTable() {
  const t = useTranslations('admin')
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [workspacesTarget, setWorkspacesTarget] = useState<AdminUserRow | null>(null)
  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchUsers = useCallback(async (q: string, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) })
      if (q.trim()) params.set('search', q.trim())
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Failed to load users')
      const body = await res.json()
      setUsers(body.users)
      setTotal(body.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset to page 1 whenever the search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchUsers(search, 1)
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    fetchUsers(search, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function toggleFlag(user: AdminUserRow, field: 'isAdmin' | 'isActive') {
    const prev = users
    setUsers(u => u.map(x => (x.id === user.id ? { ...x, [field]: !x[field] } : x)))
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !user[field] }),
    })
    if (!res.ok) {
      setUsers(prev)
      const body = await res.json().catch(() => null)
      setError(body?.error ?? t('dashboard.failedToUpdateUser'))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    const res = await fetch(`/api/admin/users/${target.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? t('dashboard.failedToDeleteUser'))
      return
    }
    fetchUsers(search, page)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-th-fg-subtle" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('dashboard.searchPlaceholder')}
            className="w-full rounded-md border border-th-border bg-th-input py-1.5 pl-8 pr-3 text-sm text-th-fg placeholder:text-th-fg-subtle focus:outline-none focus:ring-2 focus:ring-th-accent"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-th-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-th-accent-hover"
        >
          <Plus size={14} />
          {t('dashboard.newUser')}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-th-error">{error}</p>}

      <div className="overflow-hidden rounded-md border border-th-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-th-surface text-xs text-th-fg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t('dashboard.columnName')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.columnEmail')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.columnAdmin')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.columnStatus')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.columnCreated')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('dashboard.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-th-fg-subtle">
                  {t('dashboard.loading')}
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-th-fg-subtle">
                  {t('dashboard.noUsers')}
                </td>
              </tr>
            )}
            {!loading &&
              users.map(user => (
                <tr key={user.id} className={`border-t border-th-border/50 ${!user.isActive ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-2 text-th-fg">{user.name}</td>
                  <td className="px-3 py-2 text-th-fg-muted">{user.email}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleFlag(user, 'isAdmin')}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                        user.isAdmin
                          ? 'bg-th-accent/15 text-th-accent'
                          : 'bg-th-surface-hover text-th-fg-muted'
                      }`}
                    >
                      {user.isAdmin ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                      {user.isAdmin ? t('dashboard.roleAdmin') : t('dashboard.roleUser')}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleFlag(user, 'isActive')}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                        user.isActive
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-red-500/15 text-red-500'
                      }`}
                    >
                      {user.isActive ? <UserCheck size={12} /> : <UserX size={12} />}
                      {user.isActive ? t('dashboard.statusActive') : t('dashboard.statusDisabled')}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-th-fg-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditTarget(user)}
                        title={t('dashboard.editUser')}
                        className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setWorkspacesTarget(user)}
                        title={t('dashboard.viewWorkspaces')}
                        className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
                      >
                        <FolderKanban size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        title={t('dashboard.deleteUser')}
                        className="rounded p-1.5 text-th-fg-muted hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && total > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-th-fg-muted">
          <span>{t('dashboard.totalUsers', { count: total })}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-md border border-th-border px-2 py-1 hover:bg-th-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={13} />
              {t('dashboard.pagePrevious')}
            </button>
            <span>{t('dashboard.pageInfo', { page, totalPages })}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-md border border-th-border px-2 py-1 hover:bg-th-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {t('dashboard.pageNext')}
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {(showCreate || editTarget) && (
        <AdminUserModal
          user={editTarget}
          onClose={() => {
            setShowCreate(false)
            setEditTarget(null)
          }}
          onSaved={() => {
            setShowCreate(false)
            setEditTarget(null)
            fetchUsers(search, page)
          }}
        />
      )}

      {deleteTarget && (
        <AdminDeleteUserModal
          user={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {workspacesTarget && (
        <AdminUserWorkspacesModal user={workspacesTarget} onClose={() => setWorkspacesTarget(null)} />
      )}
    </div>
  )
}
