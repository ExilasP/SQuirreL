import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { Key, Link2 } from 'lucide-react'
import type { SchemaGraph, TableDetail } from '@shared/types'
import { columnKey, computeHighlight, filterGraphAround, type ErdHighlight, type ErdLink, type ErdSelection } from '@/lib/graph'
import { errMessage, useStore } from '@/lib/store'

const W = 240, ROW = 22, HEAD = 34
const EDGE_COLOR = '#7c8cff', EDGE_HIGHLIGHT_COLOR = '#ffb454'

interface ErdInteraction {
  highlight: ErdHighlight | null
  selectColumn: (table: string, column: string) => void
}

const ErdInteractionContext = createContext<ErdInteraction>({ highlight: null, selectColumn: () => {} })

function TableNode({ data }: NodeProps<Node<{ t: TableDetail }>>) {
  const { t } = data
  const fkCols = new Set(t.foreignKeys.flatMap((f) => f.columns))
  const { highlight, selectColumn } = useContext(ErdInteractionContext)
  return (
    <div className="bg-panel border border-line rounded-lg overflow-hidden shadow-lg" style={{ width: W }}>
      <div className="px-3 bg-raised font-semibold flex items-center" style={{ height: HEAD }}>{t.name}</div>
      {t.columns.map((c) => (
        <div
          key={c.name}
          onClick={(e) => { e.stopPropagation(); selectColumn(t.name, c.name) }}
          className={`relative px-3 flex items-center gap-2 text-xs border-t border-line/60 cursor-pointer hover:bg-raised ${highlight?.columns.has(columnKey(t.name, c.name)) ? 'bg-accent/30' : ''}`}
          style={{ height: ROW }}
        >
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

function layout(graph: SchemaGraph): { nodes: Node[]; edges: Edge[]; links: ErdLink[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 120 })
  const names = new Set(graph.tables.map((t) => t.name))
  graph.tables.forEach((t) => g.setNode(t.name, { width: W, height: HEAD + t.columns.length * ROW }))
  const edges: Edge[] = []
  const links: ErdLink[] = []
  graph.tables.forEach((t) => t.foreignKeys.forEach((f, i) => {
    if (!names.has(f.refTable)) return
    g.setEdge(t.name, f.refTable)
    const id = `${t.name}-${f.name}-${i}`
    links.push({ id, fromTable: t.name, fromColumns: f.columns, toTable: f.refTable, toColumns: f.refColumns })
    edges.push({
      id, source: t.name, target: f.refTable, sourceHandle: `${f.columns[0]}-s`, targetHandle: `${f.refColumns[0]}-t`,
      interactionWidth: 20
    })
  }))
  dagre.layout(g)
  const nodes: Node[] = graph.tables.map((t) => {
    const p = g.node(t.name)
    return { id: t.name, type: 'table', position: { x: p.x - W / 2, y: p.y - p.height / 2 }, data: { t } }
  })
  return { nodes, edges, links }
}

/** Applies the base or highlight styling to an edge depending on the current selection. */
function styleEdge(edge: Edge, highlight: ErdHighlight | null): Edge {
  const isHighlighted = highlight?.linkIds.has(edge.id) ?? false
  const color = isHighlighted ? EDGE_HIGHLIGHT_COLOR : EDGE_COLOR
  return {
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: isHighlighted ? 2.6 : 1.4, opacity: highlight && !isHighlighted ? 0.2 : 1 },
    zIndex: isHighlighted ? 1 : 0
  }
}

interface ErdProps {
  connId: string
  schema: string
  /** When set, only this table and its FK neighbours are drawn. */
  focusTable?: string
}

/** Entity-relationship diagram of a schema, or of one table and its neighbours. */
export function Erd({ connId, schema, focusTable }: ErdProps) {
  const setError = useStore((s) => s.setError)
  const [state, setState] = useState<{ nodes: Node[]; edges: Edge[]; links: ErdLink[] } | null>(null)
  const [selection, setSelection] = useState<ErdSelection | null>(null)

  useEffect(() => {
    setSelection(null)
    window.api.db.graph(connId, schema).then((g) => setState(layout(focusTable ? filterGraphAround(g, focusTable) : g))).catch((e) => setError(errMessage(e)))
  }, [connId, schema, focusTable, setError])

  const highlight = useMemo(() => (state && selection ? computeHighlight(state.links, selection) : null), [state, selection])
  const edges = useMemo(() => state?.edges.map((e) => styleEdge(e, highlight)) ?? [], [state, highlight])
  const interaction = useMemo<ErdInteraction>(() => ({
    highlight,
    selectColumn: (table, column) => setSelection({ kind: 'column', table, column })
  }), [highlight])

  if (!state) return <div className="h-full grid place-items-center text-dim">Loading diagram…</div>
  return (
    <ErdInteractionContext.Provider value={interaction}>
    <ReactFlow
      defaultNodes={state.nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.1} colorMode="dark" proOptions={{ hideAttribution: true }}
      elementsSelectable={false}
      onEdgeClick={(_, edge) => setSelection({ kind: 'link', id: edge.id })}
      onPaneClick={() => setSelection(null)}
    >
      <Background color="#262a35" gap={24} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="#0e0f13aa" nodeColor="#262a35" style={{ background: '#14161c' }} />
    </ReactFlow>
    </ErdInteractionContext.Provider>
  )
}
