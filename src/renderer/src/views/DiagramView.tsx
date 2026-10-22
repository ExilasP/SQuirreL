import { useEffect, useState } from 'react'
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { Key, Link2 } from 'lucide-react'
import type { SchemaGraph, TableDetail } from '@shared/types'
import { errMessage, useStore, type Tab } from '@/lib/store'

const W = 240, ROW = 22, HEAD = 34

function TableNode({ data }: NodeProps<Node<{ t: TableDetail }>>) {
  const { t } = data
  const fkCols = new Set(t.foreignKeys.flatMap((f) => f.columns))
  return (
    <div className="bg-panel border border-line rounded-lg overflow-hidden shadow-lg" style={{ width: W }}>
      <div className="px-3 bg-raised font-semibold flex items-center" style={{ height: HEAD }}>{t.name}</div>
      {t.columns.map((c) => (
        <div key={c.name} className="relative px-3 flex items-center gap-2 text-xs border-t border-line/60" style={{ height: ROW }}>
          {c.primaryKey ? <Key size={11} className="text-accent shrink-0" /> : fkCols.has(c.name) ? <Link2 size={11} className="text-ok shrink-0" /> : <span className="w-[11px]" />}
          <span className="truncate shrink-0 max-w-[120px]">{c.name}</span>
          <span className="ml-auto text-dim font-mono truncate">{c.type}</span>
          <Handle id={`${c.name}-t`} type="target" position={Position.Left} className={`!bg-accent !size-1.5 !border-0 ${c.primaryKey || fkCols.has(c.name) ? '' : '!opacity-0'}`} />
          <Handle id={`${c.name}-s`} type="source" position={Position.Right} className={`!bg-accent !size-1.5 !border-0 ${c.primaryKey || fkCols.has(c.name) ? '' : '!opacity-0'}`} />
        </div>
      ))}
    </div>
  )
}

const nodeTypes = { table: TableNode }

function layout(graph: SchemaGraph): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 120 })
  const names = new Set(graph.tables.map((t) => t.name))
  graph.tables.forEach((t) => g.setNode(t.name, { width: W, height: HEAD + t.columns.length * ROW }))
  const edges: Edge[] = []
  graph.tables.forEach((t) => t.foreignKeys.forEach((f, i) => {
    if (!names.has(f.refTable)) return
    g.setEdge(t.name, f.refTable)
    edges.push({
      id: `${t.name}-${f.name}-${i}`, source: t.name, target: f.refTable, sourceHandle: `${f.columns[0]}-s`, targetHandle: `${f.refColumns[0]}-t`,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#7c8cff' }, style: { stroke: '#7c8cff', strokeWidth: 1.4 },
      labelStyle: { fill: '#8a90a2', fontSize: 10 }, labelBgStyle: { fill: '#0e0f13' }
    })
  }))
  dagre.layout(g)
  const nodes: Node[] = graph.tables.map((t) => {
    const p = g.node(t.name)
    return { id: t.name, type: 'table', position: { x: p.x - W / 2, y: p.y - p.height / 2 }, data: { t } }
  })
  return { nodes, edges }
}

export function DiagramView({ tab }: { tab: Extract<Tab, { kind: 'diagram' }> }) {
  const setError = useStore((s) => s.setError)
  const [state, setState] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null)

  useEffect(() => {
    window.api.db.graph(tab.connId, tab.schema).then((g) => setState(layout(g))).catch((e) => setError(errMessage(e)))
  }, [tab, setError])

  if (!state) return <div className="h-full grid place-items-center text-dim">Loading diagram…</div>
  return (
    <ReactFlow defaultNodes={state.nodes} defaultEdges={state.edges} nodeTypes={nodeTypes} fitView minZoom={0.1} colorMode="dark" proOptions={{ hideAttribution: true }}>
      <Background color="#262a35" gap={24} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="#0e0f13aa" nodeColor="#262a35" style={{ background: '#14161c' }} />
    </ReactFlow>
  )
}
