import type { ReactNode } from 'react'

export interface MetaColumn<T> {
  header: string
  render(row: T): ReactNode
  /** Extra classes for the cell, e.g. `font-mono`. */
  className?: string
}

interface Props<T> {
  columns: MetaColumn<T>[]
  rows: T[]
  emptyMessage: string
}

/** Read-only table used by the structure sub-views (columns, keys, indexes, triggers). */
export function MetaTable<T>({ columns, rows, emptyMessage }: Props<T>) {
  if (!rows.length) return <div className="text-dim text-center py-10">{emptyMessage}</div>
  return (
    <div className="h-full overflow-auto">
      <table className="border-separate border-spacing-0 min-w-full text-[12.5px]">
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((c) => <th key={c.header} className="bg-panel border-b border-r border-line px-3 py-1.5 text-left font-medium whitespace-nowrap">{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-raised/60">
              {columns.map((c) => <td key={c.header} className={`border-b border-r border-line px-3 py-1.5 align-top ${c.className ?? ''}`}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Small pill used for flags such as `PK`, `UNIQUE`, `NOT NULL`. */
export function Badge({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'accent' | 'ok' }) {
  const color = tone === 'accent' ? 'text-accent border-accent/40' : tone === 'ok' ? 'text-ok border-ok/40' : 'text-dim border-line'
  return <span className={`inline-block px-1.5 mr-1 rounded border text-[10px] font-medium leading-4 ${color}`}>{children}</span>
}
