'use client'

import { useEffect } from 'react'
import { useCollectionStore } from '@/store/collection.store'
import { useEnvironmentStore } from '@/store/environment.store'
import Sidebar from '@/features/sidebar/Sidebar'
import RequestEditorPane from '@/features/request-editor/RequestEditorPane'

interface Props {
  userId: string
}

export default function WorkspaceShell({ userId }: Props) {
  const fetchCollections = useCollectionStore(s => s.fetchCollections)
  const fetchEnvironments = useEnvironmentStore(s => s.fetchEnvironments)

  useEffect(() => {
    void fetchCollections()
    void fetchEnvironments()
  }, [fetchCollections, fetchEnvironments])

  return (
    <div className="flex h-screen overflow-hidden bg-th-bg text-th-fg">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <RequestEditorPane />
      </main>
    </div>
  )
}
