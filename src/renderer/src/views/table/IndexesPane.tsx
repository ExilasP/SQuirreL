import type { IndexInfo, TableDetail } from '@shared/types'
import { Badge, MetaTable, type MetaColumn } from '@/components/MetaTable'

const columns: MetaColumn<IndexInfo>[] = [
  { header: 'Name', render: (i) => i.name },
  { header: 'Columns', className: 'font-mono', render: (i) => i.columns.join(', ') || <span className="text-dim">expression</span> },
  { header: 'Kind', render: (i) => (
    <>
      {i.primary && <Badge tone="accent">PRIMARY</Badge>}
      {i.unique && !i.primary && <Badge tone="ok">UNIQUE</Badge>}
      {i.predicate && <Badge>PARTIAL</Badge>}
    </>
  ) },
  { header: 'Method', className: 'font-mono', render: (i) => i.method },
  { header: 'Predicate', className: 'font-mono', render: (i) => i.predicate ?? '' },
  { header: 'Definition', className: 'font-mono text-dim', render: (i) => i.definition ?? 'implicit' }
]

/** Indexes of a table with their uniqueness, method and partial predicate. */
export function IndexesPane({ detail }: { detail: TableDetail }) {
  return <MetaTable columns={columns} rows={detail.indexes} emptyMessage="No indexes" />
}
