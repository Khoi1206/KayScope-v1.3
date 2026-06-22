'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useFlowStore } from '@/store/flow.store'
import type { FlowNode, FlowEdge, FlowNodeData, FlowEdgeData, NodeType } from '@/db/schema/flows'
import ActionNode from './nodes/ActionNode'
import NodePalette from './NodePalette'
import NodePropertiesPanel from './NodePropertiesPanel'
import EdgeConditionPanel from './EdgeConditionPanel'
import FlowEditorToolbar from './FlowEditorToolbar'
import FlowResultsPanel from './FlowResultsPanel'

// Helper casts: our domain types ↔ xyflow's generic Node/Edge
const toXY = (ns: FlowNode[]): Node[] => ns as unknown as Node[]
const fromXY = (ns: Node[]): FlowNode[] => ns as unknown as FlowNode[]
const toXYEdges = (es: FlowEdge[]): Edge[] => es as unknown as Edge[]
const fromXYEdges = (es: Edge[]): FlowEdge[] => es as unknown as FlowEdge[]

const nodeTypes = { action: ActionNode }

export default function FlowEditor() {
  const { flows, activeFlowId, saveCanvas, runResult, runError, resetRun } = useFlowStore()
  const flow = flows.find(f => f.id === activeFlowId)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize canvas from flow data
  useEffect(() => {
    if (!flow) return
    setNodes(toXY(flow.nodes))
    setEdges(toXYEdges(flow.edges))
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

  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes)
    setNodes(nds => {
      scheduleSave(fromXY(nds), fromXYEdges(edges))
      return nds
    })
  }, [onNodesChange, edges, scheduleSave, setNodes])

  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes)
    setEdges(eds => {
      scheduleSave(fromXY(nodes), fromXYEdges(eds))
      return eds
    })
  }, [onEdgesChange, nodes, scheduleSave, setEdges])

  const onConnect = useCallback((connection: Connection) => {
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
  }, [nodes, scheduleSave, setEdges])

  const handleAddNode = useCallback((type: NodeType, label: string) => {
    if (!activeFlowId) return
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
  }, [activeFlowId, nodes, edges, scheduleSave, setNodes])

  const handleNodeDataChange = useCallback((nodeId: string, patch: Partial<FlowNodeData>) => {
    setNodes(nds => {
      const updated = nds.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...(n.data as unknown as FlowNodeData), ...patch } as unknown as Record<string, unknown> }
          : n
      )
      scheduleSave(fromXY(updated), fromXYEdges(edges))
      return updated
    })
  }, [edges, scheduleSave, setNodes])

  const handleEdgeDataChange = useCallback((edgeId: string, data: FlowEdgeData) => {
    setEdges(eds => {
      const updated = eds.map(e =>
        e.id === edgeId
          ? { ...e, data: data as unknown as Record<string, unknown>, label: data.condition !== 'always' ? data.conditionText : undefined }
          : e
      )
      scheduleSave(fromXY(nodes), fromXYEdges(updated))
      return updated
    })
  }, [nodes, scheduleSave, setEdges])

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
    return <div className="flex flex-1 items-center justify-center text-sm text-th-fg-subtle">Flow not found</div>
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <FlowEditorToolbar flowId={flow.id} flowName={flow.name} browsers={flow.browsers} runError={runError} />

      <div className="flex" style={{ height: runResult ? '60%' : '100%', flex: runResult ? 'none' : '1' }}>
        <NodePalette onAdd={handleAddNode} />

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
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
          <NodePropertiesPanel node={selectedNode} onChange={handleNodeDataChange} />
        ) : (
          <div className="flex w-60 items-center justify-center border-l border-th-border bg-th-surface">
            <p className="px-4 text-center text-xs text-th-fg-subtle">Select a node to configure it</p>
          </div>
        )}
      </div>

      {runResult && (
        <FlowResultsPanel result={runResult} runError={runError} onClose={resetRun} />
      )}
    </div>
  )
}
