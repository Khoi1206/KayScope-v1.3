'use client'

import { useTranslations } from 'next-intl'
import {
  FolderOpen, Layers, History, Globe,
  FlaskConical, Workflow, Cookie, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useUiStore, type SidebarSection } from '@/store/ui.store'
import { cn } from '@/components/ui/cn'
import Tooltip from '@/components/ui/Tooltip'

interface ActivityBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

type NavItem = { section: SidebarSection; icon: React.ReactNode; label: string }

export default function ActivityBar({ sidebarOpen, onToggleSidebar }: ActivityBarProps) {
  const t = useTranslations()
  const { sidebarSection, setSidebarSection } = useUiStore()

  const primaryItems: NavItem[] = [
    { section: 'collections', icon: <FolderOpen size={18} />, label: t('nav.collections') },
    { section: 'environments', icon: <Layers size={18} />, label: t('nav.environments') },
    { section: 'history', icon: <History size={18} />, label: t('nav.history') },
  ]

  const secondaryItems: NavItem[] = [
    { section: 'globals', icon: <Globe size={18} />, label: t('nav.globals') },
    { section: 'tests', icon: <FlaskConical size={18} />, label: t('nav.tests') },
    { section: 'flows', icon: <Workflow size={18} />, label: t('nav.flows') },
    { section: 'cookies', icon: <Cookie size={18} />, label: t('nav.cookies') },
  ]

  function NavBtn({ section, icon, label }: NavItem) {
    const active = sidebarSection === section
    return (
      <Tooltip label={label} side="right">
        <button
          onClick={() => setSidebarSection(section)}
          aria-label={label}
          className={cn(
            'relative flex h-10 w-full items-center justify-center transition-all duration-150',
            active
              ? 'text-th-accent'
              : 'text-th-fg-subtle hover:bg-th-surface-hover hover:text-th-fg-muted'
          )}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-th-accent" />
          )}
          {icon}
        </button>
      </Tooltip>
    )
  }

  return (
    <div className="flex h-full w-11 shrink-0 flex-col items-center border-r border-th-border bg-th-surface py-2">
      {/* Primary */}
      <div className="flex w-full flex-col gap-0.5">
        {primaryItems.map(item => <NavBtn key={item.section} {...item} />)}
      </div>

      {/* Divider */}
      <div className="mx-auto my-1 h-px w-5 shrink-0 bg-th-border/40" />

      {/* Secondary */}
      <div className="flex w-full flex-col gap-0.5">
        {secondaryItems.map(item => <NavBtn key={item.section} {...item} />)}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Panel toggle */}
      <Tooltip label={sidebarOpen ? 'Collapse panel' : 'Expand panel'} side="right">
        <button
          onClick={onToggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-th-fg-subtle transition-colors hover:bg-th-surface-hover hover:text-th-fg-muted"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </Tooltip>
    </div>
  )
}
