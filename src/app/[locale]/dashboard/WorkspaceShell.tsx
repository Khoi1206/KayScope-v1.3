'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore } from '@/store/environment.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useRequestStore } from '@/store/request.store'
import { useFlowStore } from '@/store/flow.store'
import Sidebar from '@/features/sidebar/Sidebar'
import ActivityBar from '@/features/sidebar/ActivityBar'
import RequestEditorPane from '@/features/request-editor/RequestEditorPane'
import FlowEditor from '@/features/flows/FlowEditor'
import Navbar from '@/features/navbar/Navbar'
import GlobalSearchModal from '@/components/GlobalSearchModal'

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 520
const SIDEBAR_DEFAULT = 256
const STORAGE_KEY = 'sidebar-width'
const STORAGE_OPEN_KEY = 'sidebar-open'

interface Props {
  userId: string
  userName: string | null
}

export default function WorkspaceShell({ userId: _userId, userName }: Props) {
  const fetchCollections = useCollectionStore(s => s.fetchCollections)
  const fetchEnvironments = useEnvironmentStore(s => s.fetchEnvironments)
  const fetchWorkspaces = useWorkspaceStore(s => s.fetchWorkspaces)
  const fetchWorkspace = useWorkspaceStore(s => s.fetchWorkspace)
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId)
  const saveTabsForWorkspace = useRequestStore(s => s.saveTabsForWorkspace)
  const loadTabsForWorkspace = useRequestStore(s => s.loadTabsForWorkspace)
  const activeFlowId = useFlowStore(s => s.activeFlowId)
  const prevWorkspaceId = useRef<string | null>(null)

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT
    const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10)
    return isNaN(saved) ? SIDEBAR_DEFAULT : Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, saved))
  })
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem(STORAGE_OPEN_KEY)
    return saved === null ? true : saved === 'true'
  })
  const [isResizing, setIsResizing] = useState(false)
  const dragStartX = useRef<number>(0)
  const dragStartWidth = useRef<number>(0)

  useEffect(() => {
    // Apply saved theme on mount
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  // Ctrl+K → global search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setGlobalSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Initial mount: load workspaces list first, then active workspace + data
  useEffect(() => {
    void fetchWorkspaces().then(() => {
      void fetchWorkspace()
      void fetchCollections()
      void fetchEnvironments()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Workspace switch: save old tabs, load new tabs, reload data
  useEffect(() => {
    if (!activeWorkspaceId) return
    if (prevWorkspaceId.current && prevWorkspaceId.current !== activeWorkspaceId) {
      saveTabsForWorkspace(prevWorkspaceId.current)
      loadTabsForWorkspace(activeWorkspaceId)
      void fetchCollections()
      void fetchEnvironments()
    }
    prevWorkspaceId.current = activeWorkspaceId
  }, [activeWorkspaceId, saveTabsForWorkspace, loadTabsForWorkspace, fetchCollections, fetchEnvironments])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    setIsResizing(true)
  }, [sidebarWidth])

  useEffect(() => {
    if (!isResizing) return

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + delta))
      setSidebarWidth(newWidth)
    }

    const onMouseUp = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + delta))
      localStorage.setItem(STORAGE_KEY, String(newWidth))
      setIsResizing(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isResizing])

  return (
    <div className={`flex h-screen flex-col overflow-hidden bg-th-bg text-th-fg${isResizing ? ' select-none' : ''}`}>
      <Navbar userName={userName} />
      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar — always visible */}
        <ActivityBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => {
            const next = !sidebarOpen
            setSidebarOpen(next)
            localStorage.setItem(STORAGE_OPEN_KEY, String(next))
          }}
        />
        {/* Sidebar content panel — collapsible */}
        {sidebarOpen && (
          <>
            <Sidebar width={sidebarWidth} />
            <div
              onMouseDown={onMouseDown}
              className="group relative w-1 shrink-0 cursor-col-resize"
            >
              <div className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors${isResizing ? ' bg-th-accent' : ' bg-th-border group-hover:bg-th-accent'}`} />
            </div>
          </>
        )}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeFlowId ? <FlowEditor /> : <RequestEditorPane />}
        </main>
      </div>
      <GlobalSearchModal open={globalSearchOpen} onClose={() => setGlobalSearchOpen(false)} />
    </div>
  )
}
