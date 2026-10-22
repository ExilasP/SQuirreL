import type { TriggerInfo } from '@shared/types'
import { Badge, MetaTable, type MetaColumn } from '@/components/MetaTable'
import { useAsync } from '@/lib/useAsync'
import type { Tab } from '@/lib/store'

const columns: MetaColumn<TriggerInfo>[] = [
  { header: 'Name', render: (t) => t.name },
  { header: 'Timing', render: (t) => t.timing },
  { header: 'Events', render: (t) => t.events.join(' OR ') },
  { header: 'Level', render: (t) => t.level },
  { header: 'Status', render: (t) => (t.isEnabled ? <Badge tone="ok">ENABLED</Badge> : <Badge>DISABLED</Badge>) },
  { header: 'Definition', className: 'font-mono text-dim whitespace-pre-wrap', render: (t) => t.definition }
]

/** User-defined triggers attached to the table. */
export function TriggersPane({ tab }: { tab: Extract<Tab, { kind: 'table' }> }) {
  const { data } = useAsync(() => window.api.db.triggers(tab.connId, tab.schema, tab.table), [tab.connId, tab.schema, tab.table])
  if (!data) return <div className="h-full grid place-items-center text-dim">Loading triggers…</div>
  return <MetaTable columns={columns} rows={data} emptyMessage="No triggers" />
}
