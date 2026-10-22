import { Key, Link2 } from 'lucide-react'
import type { ColumnInfo, TableDetail } from '@shared/types'
import { Badge, MetaTable, type MetaColumn } from '@/components/MetaTable'

/** Column definitions of a table, flagging primary and foreign keys. */
export function ColumnsPane({ detail }: { detail: TableDetail }) {
  const fkColumns = new Set(detail.foreignKeys.flatMap((fk) => fk.columns))
  const columns: MetaColumn<ColumnInfo>[] = [
    { header: '#', className: 'text-dim text-right', render: (c) => detail.columns.indexOf(c) + 1 },
    { header: 'Name', render: (c) => (
      <span className="flex items-center gap-1.5">
        {c.primaryKey ? <Key size={12} className="text-accent" /> : fkColumns.has(c.name) ? <Link2 size={12} className="text-ok" /> : <span className="w-3" />}
        {c.name}
      </span>
    ) },
    { header: 'Type', className: 'font-mono', render: (c) => c.type },
    { header: 'Constraints', render: (c) => (
      <>
        {c.primaryKey && <Badge tone="accent">PK</Badge>}
        {fkColumns.has(c.name) && <Badge tone="ok">FK</Badge>}
        {!c.nullable && <Badge>NOT NULL</Badge>}
      </>
    ) },
    { header: 'Default', className: 'font-mono', render: (c) => c.defaultValue ?? <span className="text-dim">—</span> },
    { header: 'Comment', className: 'text-dim', render: (c) => c.comment ?? '' }
  ]
  return <MetaTable columns={columns} rows={detail.columns} emptyMessage="No columns" />
}
