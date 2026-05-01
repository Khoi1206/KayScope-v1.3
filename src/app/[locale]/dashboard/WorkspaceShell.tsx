'use client'

import { useEffect } from 'react'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore } from '@/store/environment.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useFlowStore } from '@/store/flow.store'
import Sidebar from '@/features/sidebar/Sidebar'
import RequestEditorPane from '@/features/request-editor/RequestEditorPane'
import FlowEditor from '@/features/flows/FlowEditor'
import Navbar from '@/features/navbar/Navbar'

interface Props {
  userId: string
  userName: string | null
}

export default function WorkspaceShell({ userId: _userId, userName }: Props) {
  const fetchCollections = useCollectionStore(s => s.fetchCollections)
  const fetchEnvironments = useEnvironmentStore(s => s.fetchEnvironments)
  const fetchWorkspace = useWorkspaceStore(s => s.fetchWorkspace)
  const activeFlowId = useFlowStore(s => s.activeFlowId)

  useEffect(() => {
    // Apply saved theme on mount
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    void fetchCollections()
    void fetchEnvironments()
    void fetchWorkspace()
  }, [fetchCollections, fetchEnvironments, fetchWorkspace])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-th-bg text-th-fg">
      <Navbar userName={userName} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeFlowId ? <FlowEditor /> : <RequestEditorPane />}
        </main>
      </div>
    </div>
  )
}
