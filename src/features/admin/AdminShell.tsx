'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Users, ScrollText, LogOut, UserCircle } from 'lucide-react'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ProfileModal from '@/components/ProfileModal'

interface Props {
  currentUserName: string
  children: React.ReactNode
}

export default function AdminShell({ currentUserName, children }: Props) {
  const t = useTranslations('admin')
  const params = useParams<{ locale: string }>()
  const pathname = usePathname()
  const locale = params.locale ?? 'en'
  const [showProfile, setShowProfile] = useState(false)
  const [displayName, setDisplayName] = useState(currentUserName)

  const base = `/${locale}/admin`
  const navItems = [
    { href: base, label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: `${base}/users`, label: t('nav.users'), icon: Users },
    { href: `${base}/logs`, label: t('nav.logs'), icon: ScrollText },
  ]

  return (
    <div className="flex min-h-screen bg-th-bg">
      <aside className="flex w-52 shrink-0 flex-col border-r border-th-border bg-th-nav">
        <div className="flex h-12 items-center border-b border-th-border px-4">
          <span className="text-sm font-bold tracking-tight text-th-accent">KayScope</span>
          <span className="ml-2 rounded bg-th-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-th-accent">
            {t('nav.badge')}
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map(item => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-th-accent/15 font-medium text-th-accent'
                    : 'text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-th-border px-6">
          <div>
            <h1 className="text-sm font-semibold text-th-fg">{t('dashboard.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProfile(true)}
              title={t('nav.profile')}
              className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
            >
              <UserCircle size={15} />
              {displayName}
            </button>
            <LocaleSwitcher />
            <ThemeSwitcher />
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              title={t('dashboard.signOut')}
              className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} onNameChanged={setDisplayName} />
      )}
    </div>
  )
}
