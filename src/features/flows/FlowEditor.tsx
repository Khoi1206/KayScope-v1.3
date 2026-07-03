'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { useFlowStore } from '@/store/flow.store'
import type { FlowNode, FlowEdge, FlowNodeData, FlowEdgeData, NodeType } from '@/db/schema/flows'
import ActionNode from './nodes/ActionNode'
import NodePalette from './NodePalette'
import NodePropertiesPanel from './NodePropertiesPanel'
import EdgeConditionPanel from './EdgeConditionPanel'
import FlowEditorToolbar from './FlowEditorToolbar'
import FlowResultsPanel from './FlowResultsPanel'
import FlowVersionsPanel from './FlowVersionsPanel'

// Helper casts: our domain types ↔ xyflow's generic Node/Edge
const toXY = (ns: FlowNode[]): Node[] => ns as unknown as Node[]
const fromXY = (ns: Node[]): FlowNode[] => ns as unknown as FlowNode[]
const toXYEdges = (es: FlowEdge[]): Edge[] => es as unknown as Edge[]
const fromXYEdges = (es: Edge[]): FlowEdge[] => es as unknown as FlowEdge[]

const nodeTypes = { action: ActionNode }

const MAX_HISTORY = 50
/** How long a burst of rapid edits (e.g. typing in a text field) collapses into a single undo step. */
const HISTORY_BURST_MS = 800

/** True for text inputs / selects / contentEditable — used to keep global shortcuts (undo, duplicate, search) from firing while the user is typing in a field. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

type CanvasSnapshot = { nodes: Node[]; edges: Edge[] }

export default function FlowEditor() {
  const t = useTranslations('flows')
  const { flows, activeFlowId, saveCanvas, runResult, runRecord, runError, resetRun, restoreVersion } = useFlowStore()
  const flow = flows.find(f => f.id === activeFlowId)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Undo/redo history — refs (not state) since pushes happen inside other
  // callbacks and shouldn't themselves trigger re-renders.
  const historyPast = useRef<CanvasSnapshot[]>([])
  const historyFuture = useRef<CanvasSnapshot[]>([])
  const historyBurstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyBurstActive = useRef(false)

  // Initialize canvas from flow data
  useEffect(() => {
    if (!flow) return
    setNodes(toXY(flow.nodes))
    setEdges(toXYEdges(flow.edges))
    historyPast.current = []
    historyFuture.current = []
    historyBurstActive.current = false
  }, [flow?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  const scheduleSave = useCallback((newNodes: FlowNode[], newEdges: FlowEdge[]) => {
    if (!activeFlowId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveCanvas(activeFlowId, newNodes, newEdges)
    }, 800)
  }, [activeFlowId, saveCanvas])

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  // Snapshot the canvas as it is *right now* (call before applying a mutation).
  const pushHistory = useCallback(() => {
    historyPast.current.push({ nodes, edges })
    if (historyPast.current.length > MAX_HISTORY) historyPast.current.shift()
    historyFuture.current = []
  }, [nodes, edges])

  // For continuous edits (typing in a field): only snapshot at the *start* of a
  // burst, so undo reverts a whole editing session instead of one keystroke.
  const pushHistoryDebounced = useCallback(() => {
    if (!historyBurstActive.current) {
      pushHistory()
      historyBurstActive.current = true
    }
    if (historyBurstTimer.current) clearTimeout(historyBurstTimer.current)
    historyBurstTimer.current = setTimeout(() => { historyBurstActive.current = false }, HISTORY_BURST_MS)
  }, [pushHistory])

  useEffect(() => {
    return () => { if (historyBurstTimer.current) clearTimeout(historyBurstTimer.current) }
  }, [])

  const undo = useCallback(() => {
    const prev = historyPast.current.pop()
    if (!prev) return
    historyFuture.current.push({ nodes, edges })
    setNodes(prev.nodes)
    setEdges(prev.edges)
    scheduleSave(fromXY(prev.nodes), fromXYEdges(prev.edges))
  }, [nodes, edges, setNodes, setEdges, scheduleSave])

  const redo = useCallback(() => {
    const next = historyFuture.current.pop()
    if (!next) return
    historyPast.current.push({ nodes, edges })
    setNodes(next.nodes)
    setEdges(next.edges)
    scheduleSave(fromXY(next.nodes), fromXYEdges(next.edges))
  }, [nodes, edges, setNodes, setEdges, scheduleSave])

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    if (changes.some(c => c.type === 'remove')) pushHistory()
    onNodesChange(changes)
    setNodes(nds => {
      scheduleSave(fromXY(nds), fromXYEdges(edges))
      return nds
    })
  }, [onNodesChange, edges, scheduleSave, setNodes, pushHistory])

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    if (changes.some(c => c.type === 'remove')) pushHistory()
    onEdgesChange(changes)
    setEdges(eds => {
      scheduleSave(fromXY(nodes), fromXYEdges(eds))
      return eds
    })
  }, [onEdgesChange, nodes, scheduleSave, setEdges, pushHistory])

  // One history entry per drag, captured before the drag moves anything.
  const handleNodeDragStart = useCallback(() => { pushHistory() }, [pushHistory])

  const onConnect = useCallback((connection: Connection) => {
    pushHistory()
    const newEdge = {
      ...connection,
      id: crypto.randomUUID(),
      data: { condition: 'always' } satisfies FlowEdgeData,
    }
    setEdges(eds => {
      const updated = addEdge(newEdge as unknown as Edge, eds)
      scheduleSave(fromXY(nodes), fromXYEdges(updated))
      return updated
    })
  }, [nodes, scheduleSave, setEdges, pushHistory])

  const handleAddNode = useCallback((type: NodeType, label: string) => {
    if (!activeFlowId) return
    pushHistory()
    const id = crypto.randomUUID()
    const col = nodes.length % 4
    const row = Math.floor(nodes.length / 4)
    const newNode: FlowNode = {
      id,
      type: 'action',
      position: { x: 180 + col * 260, y: 100 + row * 140 },
      data: { type, label },
    }
    setNodes(nds => {
      const updated = [...nds, ...toXY([newNode])]
      scheduleSave(fromXY(updated), fromXYEdges(edges))
      return updated
    })
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
  }, [activeFlowId, nodes, edges, scheduleSave, setNodes, pushHistory])

  const duplicateSelected = useCallback(() => {
    if (!selectedNodeId) return
    const original = fromXY(nodes).find(n => n.id === selectedNodeId)
    if (!original) return
    pushHistory()
    const newId = crypto.randomUUID()
    const clone: FlowNode = {
      id: newId,
      type: 'action',
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: structuredClone(original.data),
    }
    setNodes(nds => {
      const updated = [...nds, ...toXY([clone])]
      scheduleSave(fromXY(updated), fromXYEdges(edges))
      return updated
    })
    setSelectedNodeId(newId)
    setSelectedEdgeId(null)
  }, [selectedNodeId, nodes, edges, scheduleSave, setNodes, pushHistory])

  const handleNodeDataChange = useCallback((nodeId: string, patch: Partial<FlowNodeData>) => {
    pushHistoryDebounced()
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...(n.data as unknown as FlowNodeData), ...patch } as unknown as Record<string, unknown> }
          : n
      )
      scheduleSave(fromXY(updated), fromXYEdges(edges))
      return updated
    })
  }, [edges, scheduleSave, setNodes, pushHistoryDebounced])

  const handleEdgeDataChange = useCallback((edgeId: string, data: FlowEdgeData) => {
    pushHistoryDebounced()
    setEdges(eds => {
      const updated = eds.map(e =>
        e.id === edgeId
          ? { ...e, data: data as unknown as Record<string, unknown>, label: data.condition !== 'always' ? data.conditionText : undefined }
          : e
      )
      scheduleSave(fromXY(nodes), fromXYEdges(updated))
      return updated
    })
  }, [nodes, scheduleSave, setEdges, pushHistoryDebounced])

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!activeFlowId) return
    const restored = await restoreVersion(activeFlowId, versionId)
    pushHistory()
    setNodes(toXY(restored.nodes))
    setEdges(toXYEdges(restored.edges))
    scheduleSave(restored.nodes, restored.edges)
  }, [activeFlowId, restoreVersion, pushHistory, scheduleSave, setNodes, setEdges])

  // Global shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, Ctrl/Cmd+D duplicate.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo() }
      else if (key === 'd') { e.preventDefault(); duplicateSelected() }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [undo, redo, duplicateSelected])

  const selectedNode = useMemo(
    () => fromXY(nodes).find(n => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  )
  const selectedEdge = useMemo(
    () => fromXYEdges(edges).find(e => e.id === selectedEdgeId),
    [edges, selectedEdgeId]
  )

  const siblingEdgeCount = useMemo(() => {
    if (!selectedEdge) return 0
    return edges.filter(e => e.source === selectedEdge.source && e.id !== selectedEdge.id).length
  }, [edges, selectedEdge])

  if (!flow) {
    return <div className="flex flex-1 items-center justify-center text-sm text-th-fg-subtle">{t('notFound')}</div>
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <FlowEditorToolbar
        flowId={flow.id}
        flowName={flow.name}
        browsers={flow.browsers}
        environmentId={flow.environmentId}
        timeoutMs={flow.timeoutMs}
        runError={runError}
        onOpenVersions={() => setShowVersions(true)}
      />

      <div className="flex" style={{ height: runResult ? '60%' : '100%', flex: runResult ? 'none' : '1' }}>
        <NodePalette onAdd={handleAddNode} />

        <div className="relative flex-1">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeDragStart={handleNodeDragStart}
              nodeTypes={nodeTypes}
              onNodeClick={(_e, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null) }}
              onEdgeClick={(_e, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null) }}
              onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
              fitView
              deleteKeyCode="Delete"
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap nodeStrokeWidth={3} zoomable pannable />
            </ReactFlow>

            <FlowNodeSearch
              nodes={fromXY(nodes)}
              onSelect={id => { setSelectedNodeId(id); setSelectedEdgeId(null) }}
            />
          </ReactFlowProvider>

          {selectedEdge && (
            <EdgeConditionPanel
              edge={selectedEdge}
              siblingCount={siblingEdgeCount}
              onChange={handleEdgeDataChange}
              onClose={() => setSelectedEdgeId(null)}
            />
          )}
        </div>

        {selectedNode ? (
          <NodePropertiesPanel node={selectedNode} onChange={handleNodeDataChange} onDuplicate={duplicateSelected} />
        ) : (
          <div className="flex w-60 items-center justify-center border-l border-th-border bg-th-surface">
            <p className="px-4 text-center text-xs text-th-fg-subtle">{t('noNodeSelected')}</p>
          </div>
        )}
      </div>

      {runResult && (
        <FlowResultsPanel result={runResult} runError={runError} runId={runRecord?.id} onClose={resetRun} />
      )}

      {showVersions && (
        <FlowVersionsPanel
          flowId={flow.id}
          nodes={fromXY(nodes)}
          edges={fromXYEdges(edges)}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  )
}

function FlowNodeSearch({ nodes, onSelect }: { nodes: FlowNode[]; onSelect: (id: string) => void }) {
  const t = useTranslations('flows')
  const { setCenter, getZoom } = useReactFlow()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !isEditableTarget(e.target)) {
        e.preventDefault()
        setOpen(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return nodes.filter(n => n.data.label.toLowerCase().includes(q)).slice(0, 8)
  }, [nodes, query])

  function goTo(node: FlowNode) {
    onSelect(node.id)
    setCenter(node.position.x + 90, node.position.y + 40, { zoom: Math.max(getZoom(), 1), duration: 400 })
    setOpen(false)
    setQuery('')
  }

  function close() {
    setOpen(false)
    setQuery('')
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()) }}
        title={t('search.hint')}
        className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md border border-th-border bg-th-surface px-2.5 py-1.5 text-xs text-th-fg-muted shadow hover:bg-th-surface-hover hover:text-th-fg"
      >
        <Search size={12} />
        {t('search.button')}
      </button>
    )
  }

  return (
    <div className="absolute left-3 top-3 z-10 w-64 rounded-md border border-th-border bg-th-surface shadow-lg">
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && matches[0]) goTo(matches[0])
          if (e.key === 'Escape') close()
        }}
        onBlur={() => { if (!query) close() }}
        placeholder={t('search.placeholder')}
        className="w-full rounded-t-md border-b border-th-border bg-th-input px-2.5 py-1.5 text-xs text-th-fg outline-none"
      />
      {matches.length > 0 && (
        <div className="max-h-52 overflow-y-auto py-1">
          {matches.map(n => (
            <button
              key={n.id}
              onClick={() => goTo(n)}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-th-fg hover:bg-th-surface-hover"
            >
              <span className="truncate">{n.data.label || t('properties.untitled')}</span>
              <span className="ml-auto shrink-0 text-[10px] text-th-fg-subtle">{t(`palette.${n.data.type}`)}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="px-2.5 py-2 text-[11px] text-th-fg-subtle">{t('search.noMatches')}</p>
      )}
    </div>
  )
}
