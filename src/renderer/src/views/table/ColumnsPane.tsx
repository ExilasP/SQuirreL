import { useRef, useState } from 'react'
import { Key, Link2 } from 'lucide-react'
import type { ColumnInfo, TableDetail } from '@shared/types'
import { Badge, MetaTable, type MetaColumn } from '@/components/MetaTable'
import { SearchField } from '@/components/SearchField'
import { useFindScope } from '@/lib/findScopes'
import { matchesQuery } from '@/lib/search'

/** Whether a column definition matches the search, by name, type or comment. */
const matchesColumn = (column: ColumnInfo, query: string): boolean =>
  [column.name, column.type, column.comment ?? ''].some((text) => matchesQuery(text, query))

/** Column definitions of a table, flagging primary and foreign keys, with a Ctrl+F filter. */
export function ColumnsPane({ detail }: { detail: TableDetail }) {
  const paneRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  useFindScope(paneRef, () => { searchRef.current?.focus(); searchRef.current?.select() })
  const shown = detail.columns.filter((c) => matchesColumn(c, query))
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
  return (
    <div ref={paneRef} className="h-full flex flex-col">
      <div className="flex items-center px-3 h-12 border-b border-line">
        <SearchField ref={searchRef} className="w-80" placeholder="Filter columns by name, type or comment…" value={query} onChange={setQuery}
          status={`${shown.length} / ${detail.columns.length}`} hasNoMatch={shown.length === 0} />
      </div>
      <div className="flex-1 min-h-0">
        <MetaTable columns={columns} rows={shown} emptyMessage={query ? 'No matching column' : 'No columns'} />
      </div>
    </div>
  )
}
