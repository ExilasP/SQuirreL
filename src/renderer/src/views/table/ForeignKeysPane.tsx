import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ForeignKey, TableDetail } from '@shared/types'
import { MetaTable, type MetaColumn } from '@/components/MetaTable'
import { useAsync } from '@/lib/useAsync'
import type { Tab } from '@/lib/store'

interface KeyRow {
  direction: 'outgoing' | 'incoming'
  fk: ForeignKey
  /** Table owning the foreign key columns. */
  owner: string
}

const side = (table: string, columns: string[]) => `${table}(${columns.join(', ')})`

const columns: MetaColumn<KeyRow>[] = [
  { header: '', render: (r) => (r.direction === 'outgoing'
    ? <ArrowRight size={13} className="text-accent" aria-label="References" />
    : <ArrowLeft size={13} className="text-ok" aria-label="Referenced by" />) },
  { header: 'Name', render: (r) => r.fk.name },
  { header: 'From', className: 'font-mono', render: (r) => side(r.owner, r.fk.columns) },
  { header: 'To', className: 'font-mono', render: (r) => side(r.fk.refTable, r.fk.refColumns) },
  { header: 'On update', render: (r) => r.fk.onUpdate },
  { header: 'On delete', render: (r) => r.fk.onDelete }
]

/** Foreign keys leaving the table, plus those of other tables pointing at it. */
export function ForeignKeysPane({ tab, detail }: { tab: Extract<Tab, { kind: 'table' }>; detail: TableDetail }) {
  const { data: graph } = useAsync(() => window.api.db.graph(tab.connId, tab.schema), [tab.connId, tab.schema])
  const outgoing = detail.foreignKeys.map((fk): KeyRow => ({ direction: 'outgoing', fk, owner: detail.name }))
  // Self-references already show up as outgoing keys.
  const incoming = (graph?.tables ?? [])
    .filter((t) => t.name !== detail.name)
    .flatMap((t) => t.foreignKeys.filter((fk) => fk.refTable === detail.name).map((fk): KeyRow => ({ direction: 'incoming', fk, owner: t.name })))
  return <MetaTable columns={columns} rows={[...outgoing, ...incoming]} emptyMessage="No foreign keys" />
}
