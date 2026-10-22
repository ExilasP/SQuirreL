import { useMemo, useState, type ComponentType } from 'react'
import { Code2, Database, GitBranch, Key, Link2, ListTree, Network, Zap } from 'lucide-react'
import type { TableDetail } from '@shared/types'
import { Erd } from '@/components/Erd'
import { toDbml } from '@/lib/dbml'
import { formatSql } from '@/lib/formatSql'
import { useStore, type Tab } from '@/lib/store'
import { useAsync } from '@/lib/useAsync'
import { CodePane } from './table/CodePane'
import { ColumnsPane } from './table/ColumnsPane'
import { DataPane } from './table/DataPane'
import { ForeignKeysPane } from './table/ForeignKeysPane'
import { IndexesPane } from './table/IndexesPane'
import { TriggersPane } from './table/TriggersPane'

type TableTab = Extract<Tab, { kind: 'table' }>
type PaneId = 'data' | 'columns' | 'foreignKeys' | 'indexes' | 'triggers' | 'ddl' | 'dbml' | 'erd'

interface PaneDef {
  id: PaneId
  label: string
  icon: ComponentType<{ size?: number }>
  /** Number shown next to the label, when the pane lists items. */
  count?(detail: TableDetail): number
  /** Panes hidden for views, which have no keys or indexes of their own. */
  isTableOnly?: boolean
}

const PANES: PaneDef[] = [
  { id: 'data', label: 'Data', icon: Database },
  { id: 'columns', label: 'Columns', icon: ListTree, count: (d) => d.columns.length },
  { id: 'foreignKeys', label: 'Foreign keys', icon: Link2, count: (d) => d.foreignKeys.length, isTableOnly: true },
  { id: 'indexes', label: 'Indexes', icon: Key, count: (d) => d.indexes.length, isTableOnly: true },
  { id: 'triggers', label: 'Triggers', icon: Zap },
  { id: 'ddl', label: 'DDL', icon: Code2 },
  { id: 'dbml', label: 'DBML', icon: GitBranch },
  { id: 'erd', label: 'ERD', icon: Network }
]

/** Table tab: a data grid plus read-only structure sub-views, as in DBeaver or Beekeeper. */
export function TableView({ tab }: { tab: TableTab }) {
  const [paneId, setPaneId] = useState<PaneId>('data')
  // Refetched on every pane switch so structure changes made elsewhere show up.
  const { data: detail } = useAsync(() => window.api.db.describe(tab.connId, tab.schema, tab.table), [tab.connId, tab.schema, tab.table, paneId])
  const panes = PANES.filter((p) => !(p.isTableOnly && detail?.kind === 'view'))

  return (
    <div className="h-full flex flex-col">
      <div className="flex h-9 items-end gap-1 px-2 border-b border-line bg-panel overflow-x-auto">
        {panes.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setPaneId(id)}
            className={`flex items-center gap-1.5 h-8 px-3 whitespace-nowrap border-b-2 ${id === paneId ? 'border-accent text-fg' : 'border-transparent text-dim hover:text-fg'}`}>
            <Icon size={13} /> {label}
            {detail && count && <span className="text-[10px] text-dim">{count(detail)}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 relative">
        {/* The data pane stays mounted so paging, sort and filter survive a pane switch. */}
        <div className={`absolute inset-0 ${paneId === 'data' ? '' : 'hidden'}`}><DataPane tab={tab} /></div>
        {paneId !== 'data' && <div className="absolute inset-0"><StructurePane paneId={paneId} tab={tab} detail={detail} /></div>}
      </div>
    </div>
  )
}

interface StructurePaneProps {
  paneId: Exclude<PaneId, 'data'>
  tab: TableTab
  detail: TableDetail | null
}

function StructurePane({ paneId, tab, detail }: StructurePaneProps) {
  switch (paneId) {
    case 'columns': return detail ? <ColumnsPane detail={detail} /> : <Loading />
    case 'foreignKeys': return detail ? <ForeignKeysPane tab={tab} detail={detail} /> : <Loading />
    case 'indexes': return detail ? <IndexesPane detail={detail} /> : <Loading />
    case 'triggers': return <TriggersPane tab={tab} />
    case 'ddl': return <DdlPane tab={tab} />
    case 'dbml': return <DbmlPane tab={tab} />
    case 'erd': return <Erd connId={tab.connId} schema={tab.schema} focusTable={tab.table} />
  }
}

const Loading = () => <div className="h-full grid place-items-center text-dim">Loading…</div>

function DdlPane({ tab }: { tab: TableTab }) {
  const { data } = useAsync(() => window.api.db.ddl(tab.connId, tab.schema, tab.table), [tab.connId, tab.schema, tab.table])
  const driver = useStore((s) => s.connections.find((c) => c.id === tab.connId)?.driver)
  const code = useMemo(() => (data !== null && driver ? formatSql(data, driver) : data), [data, driver])
  return <CodePane code={code} emptyMessage="No DDL available" sqlDriver={driver} />
}

function DbmlPane({ tab }: { tab: TableTab }) {
  const { data: graph } = useAsync(() => window.api.db.graph(tab.connId, tab.schema), [tab.connId, tab.schema])
  const code = useMemo(() => (graph ? toDbml(graph, tab.table) : null), [graph, tab.table])
  return <CodePane code={code} emptyMessage="Nothing to export" />
}
