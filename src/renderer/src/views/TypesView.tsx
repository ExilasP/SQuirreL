import { useState } from 'react'
import { Code2, Shapes } from 'lucide-react'
import type { TypeInfo, TypeKind } from '@shared/types'
import { Badge, MetaTable, type MetaColumn } from '@/components/MetaTable'
import { useAsync } from '@/lib/useAsync'
import type { Tab } from '@/lib/store'
import { CodePane } from './table/CodePane'

type PaneId = 'list' | 'ddl'

const KIND_LABELS: Record<TypeKind, string> = { enum: 'ENUM', composite: 'COMPOSITE', domain: 'DOMAIN', range: 'RANGE' }

/** One-line summary of what the type holds, specific to its kind. */
function describeType(t: TypeInfo): string {
  switch (t.kind) {
    case 'enum': return t.labels.join(', ')
    case 'composite': return t.attributes.map((a) => `${a.name} ${a.type}`).join(', ')
    case 'range': return `subtype ${t.baseType}`
    case 'domain': return [t.baseType, t.isNotNull ? 'NOT NULL' : '', t.defaultValue !== null ? `DEFAULT ${t.defaultValue}` : '', ...t.checks].filter(Boolean).join(' ')
  }
}

const columns: MetaColumn<TypeInfo>[] = [
  { header: 'Name', className: 'font-medium', render: (t) => t.name },
  { header: 'Kind', render: (t) => <Badge tone={t.kind === 'enum' ? 'accent' : t.kind === 'domain' ? 'ok' : 'dim'}>{KIND_LABELS[t.kind]}</Badge> },
  { header: 'Definition', className: 'font-mono', render: describeType },
  { header: 'Owner', render: (t) => t.owner },
  { header: 'Comment', className: 'text-dim', render: (t) => t.comment ?? '' }
]

const PANES = [
  { id: 'list' as const, label: 'Types', icon: Shapes },
  { id: 'ddl' as const, label: 'DDL', icon: Code2 }
]

/** User-defined types of one schema (PostgreSQL): enums, composites, domains and ranges. */
export function TypesView({ tab }: { tab: Extract<Tab, { kind: 'types' }> }) {
  const [paneId, setPaneId] = useState<PaneId>('list')
  // Refetched on every pane switch so types created from a query tab show up.
  const { data } = useAsync(() => window.api.db.types(tab.connId, tab.schema), [tab.connId, tab.schema, paneId])

  return (
    <div className="h-full flex flex-col">
      <div className="flex h-9 items-end gap-1 px-2 border-b border-line bg-panel">
        {PANES.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPaneId(id)}
            className={`flex items-center gap-1.5 h-8 px-3 whitespace-nowrap border-b-2 ${id === paneId ? 'border-accent text-fg' : 'border-transparent text-dim hover:text-fg'}`}>
            <Icon size={13} /> {label}
            {id === 'list' && data && <span className="text-[10px] text-dim">{data.length}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {paneId === 'list'
          ? (data ? <MetaTable columns={columns} rows={data} emptyMessage="No user-defined types in this schema" /> : <div className="h-full grid place-items-center text-dim">Loading types…</div>)
          : <CodePane code={data ? data.map((t) => t.definition).join('\n\n') : null} emptyMessage="No user-defined types in this schema" sqlDriver="postgres" />}
      </div>
    </div>
  )
}
