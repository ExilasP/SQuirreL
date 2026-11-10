import { createContext, useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Background, Controls, Handle, MarkerType, MiniMap, Panel, Position, ReactFlow, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { Key, Link2 } from 'lucide-react'
import type { SchemaGraph, TableDetail } from '@shared/types'
import { columnKey, computeHighlight, filterGraphAround, listErdSearchTargets, matchesErdSearchTarget, type ErdHighlight, type ErdLink, type ErdSearchTarget, type ErdSelection } from '@/lib/graph'
import { errMessage, useStore } from '@/lib/store'
import { useFindScope } from '@/lib/findScopes'
import { useCyclingSearch, type CyclingSearch } from '@/lib/useCyclingSearch'
import { searchHitClassName } from '@/lib/searchHighlight'
import { SearchField } from './SearchField'

const W = 240, ROW = 22, HEAD = 34
const EDGE_COLOR = '#7c8cff', EDGE_HIGHLIGHT_COLOR = '#ffb454'

/** What the Ctrl+F search found, as drawn on the table nodes. */
interface ErdSearchState {
  tables: Set<string>
  /** Keys built by {@link columnKey}. */
  columns: Set<string>
  current: ErdSearchTarget | null
}

interface ErdInteraction {
  highlight: ErdHighlight | null
  search: ErdSearchState
  selectColumn: (table: string, column: string) => void
}

const NO_SEARCH: ErdSearchState = { tables: new Set(), columns: new Set(), current: null }
const ErdInteractionContext = createContext<ErdInteraction>({ highlight: null, search: NO_SEARCH, selectColumn: () => {} })

function TableNode({ data }: NodeProps<Node<{ t: TableDetail }>>) {
  const { t } = data
  const fkCols = new Set(t.foreignKeys.flatMap((f) => f.columns))
  const { highlight, search, selectColumn } = useContext(ErdInteractionContext)
  const isCurrentHit = (column?: string) => search.current?.table === t.name && search.current.column === column
  return (
    <div className="bg-panel border border-line rounded-lg overflow-hidden shadow-lg" style={{ width: W }}>
      <div className={`px-3 bg-raised font-semibold flex items-center ${searchHitClassName(search.tables.has(t.name), isCurrentHit())}`} style={{ height: HEAD }}>{t.name}</div>
      {t.columns.map((c) => (
        <div
          key={c.name}
          onClick={(e) => { e.stopPropagation(); selectColumn(t.name, c.name) }}
          className={`relative px-3 flex items-center gap-2 text-xs border-t border-line/60 cursor-pointer hover:bg-raised ${highlight?.columns.has(columnKey(t.name, c.name)) ? 'bg-accent/30' : ''} ${searchHitClassName(search.columns.has(columnKey(t.name, c.name)), isCurrentHit(c.name))}`}
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

interface ErdLayout { nodes: Node[]; edges: Edge[]; links: ErdLink[]; searchTargets: ErdSearchTarget[] }

function layout(graph: SchemaGraph): ErdLayout {
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
  return { nodes, edges, links, searchTargets: listErdSearchTargets(graph.tables) }
}

/** Splits the search hits into the lookups used by {@link TableNode}. */
function toSearchState(matches: ErdSearchTarget[], current: ErdSearchTarget | null): ErdSearchState {
  const tables = new Set(matches.filter((m) => m.column === undefined).map((m) => m.table))
  const columns = new Set(matches.flatMap((m) => (m.column === undefined ? [] : [columnKey(m.table, m.column)])))
  return { tables, columns, current }
}

interface ErdSearchPanelProps {
  search: CyclingSearch<ErdSearchTarget>
  inputRef: RefObject<HTMLInputElement | null>
}

/** Ctrl+F field over the diagram; pans and zooms to the current hit. Must be rendered inside `ReactFlow`. */
function ErdSearchPanel({ search, inputRef }: ErdSearchPanelProps) {
  const { getNode, getZoom, setCenter } = useReactFlow()
  const { current } = search
  useEffect(() => {
    if (!current) return
    const node = getNode(current.table)
    if (!node) return
    const table = node.data.t as TableDetail
    const columnIndex = current.column === undefined ? -1 : table.columns.findIndex((c) => c.name === current.column)
    const y = node.position.y + (columnIndex === -1 ? HEAD / 2 : HEAD + columnIndex * ROW + ROW / 2)
    void setCenter(node.position.x + W / 2, y, { zoom: Math.max(getZoom(), 1), duration: 300 })
  }, [current, getNode, getZoom, setCenter])
  return (
    <Panel position="top-left">
      <SearchField ref={inputRef} className="w-72" placeholder="Find table or column…" value={search.query} onChange={search.setQuery}
        status={`${search.position} / ${search.matches.length}`}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search.step(e.shiftKey ? -1 : 1) } }} />
    </Panel>
  )
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

/** Stable fallback so the search does not recompute while the diagram loads. */
const NO_TARGETS: ErdSearchTarget[] = []

interface ErdProps {
  connId: string
  schema: string
  /** When set, only this table and its FK neighbours are drawn. */
  focusTable?: string
}

/** Entity-relationship diagram of a schema, or of one table and its neighbours. */
export function Erd({ connId, schema, focusTable }: ErdProps) {
  const setError = useStore((s) => s.setError)
  const [state, setState] = useState<ErdLayout | null>(null)
  const [selection, setSelection] = useState<ErdSelection | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const search = useCyclingSearch(state?.searchTargets ?? NO_TARGETS, matchesErdSearchTarget)
  useFindScope(containerRef, () => { searchInputRef.current?.focus(); searchInputRef.current?.select() })

  useEffect(() => {
    setSelection(null)
    window.api.db.graph(connId, schema).then((g) => setState(layout(focusTable ? filterGraphAround(g, focusTable) : g))).catch((e) => setError(errMessage(e)))
  }, [connId, schema, focusTable, setError])

  const highlight = useMemo(() => (state && selection ? computeHighlight(state.links, selection) : null), [state, selection])
  const edges = useMemo(() => state?.edges.map((e) => styleEdge(e, highlight)) ?? [], [state, highlight])
  const searchState = useMemo(() => toSearchState(search.matches, search.current), [search.matches, search.current])
  const interaction = useMemo<ErdInteraction>(() => ({
    highlight,
    search: searchState,
    selectColumn: (table, column) => setSelection({ kind: 'column', table, column })
  }), [highlight, searchState])

  // The container is mounted even while loading, so Ctrl+F never falls through to the sidebar.
  return (
    <div ref={containerRef} className="h-full">
    {!state ? <div className="h-full grid place-items-center text-dim">Loading diagram…</div> : (
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
      <ErdSearchPanel search={search} inputRef={searchInputRef} />
    </ReactFlow>
    </ErdInteractionContext.Provider>
    )}
    </div>
  )
}
