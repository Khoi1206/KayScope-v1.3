'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { LogOut, UserCircle } from 'lucide-react'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher'
import ProfileModal from '@/components/ProfileModal'

interface Props {
  userName: string | null
}

export default function Navbar({ userName }: Props) {
  const tc = useTranslations('common')
  const [showProfile, setShowProfile] = useState(false)
  const [displayName, setDisplayName] = useState(userName)

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-th-border bg-th-nav px-4">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-tight text-th-accent">KayScope</span>
        <span className="h-4 w-px bg-th-border" />
        <WorkspaceSwitcher />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowProfile(true)}
          title={tc('profile')}
          className="mr-1 flex items-center gap-1.5 rounded px-2 py-1 text-xs text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
        >
          <UserCircle size={15} />
          {displayName}
        </button>
        <LocaleSwitcher />
        <ThemeSwitcher />
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          title={tc('signOut')}
          className="rounded p-1.5 text-th-fg-muted hover:bg-th-surface-hover hover:text-th-fg"
        >
          <LogOut size={15} />
        </button>
      </div>

      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} onNameChanged={setDisplayName} />
      )}
    </header>
  )
}
