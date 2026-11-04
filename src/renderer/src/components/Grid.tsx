import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { display } from '@/lib/format'
import { useGridSelection } from '@/lib/useGridSelection'
import type { CellPosition } from '@/lib/gridSelection'

interface Props {
  columns: string[]
  rows: Record<string, unknown>[]
  pkColumns?: Set<string>
  sort?: { column: string; dir: 'asc' | 'desc' } | null
  onSort?(column: string): void
  /** enables inline editing */
  onEdit?(rowIndex: number, column: string, value: unknown): Promise<void> | void
  /** Clears the selection when it changes; see `useGridSelection`. */
  selectionResetKey?: unknown
  /** Receives the indices of the selected rows (or of the active cell's row) whenever they change. */
  onSelectedRowsChange?(rows: number[]): void
}

/** Background of a body row depending on how it is selected. */
const rowClassName = (isSelected: boolean, hasActiveCell: boolean): string =>
  isSelected ? 'bg-accent-soft' : hasActiveCell ? 'bg-raised/60' : 'hover:bg-raised/60'

export function Grid({ columns, rows, pkColumns, sort, onSort, onEdit, selectionResetKey, onSelectedRowsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState<{ r: number; c: string; v: string } | null>(null)

  const startEditing = ({ row, column }: CellPosition) => {
    if (!onEdit) return
    const value = rows[row][column]
    setEditing({ r: row, c: column, v: value === null ? '' : display(value) })
  }
  const { selection, selectCell, selectRow, onKeyDown } = useGridSelection({
    columns, rows, containerRef, resetKey: selectionResetKey, onEditCell: startEditing, onSelectedRowsChange
  })

  /** Leaves the editor and gives the keyboard back to the grid. */
  const stopEditing = () => { setEditing(null); containerRef.current?.focus() }

  const commit = async (value: unknown) => {
    if (!editing) return
    const { r, c } = editing; stopEditing()
    if (value !== rows[r][c]) await onEdit?.(r, c, value)
  }

  return (
    // Focusable so that keyboard navigation and Ctrl+C reach the grid once a cell has been clicked.
    <div ref={containerRef} tabIndex={0} onKeyDown={onKeyDown} className="h-full overflow-auto font-mono text-[12.5px] outline-none">
      <table className="border-separate border-spacing-0 min-w-full">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="w-10 bg-panel border-b border-r border-line text-dim text-right px-2 py-1.5 font-normal">#</th>
            {columns.map((c) => (
              <th key={c} onClick={() => onSort?.(c)} className="bg-panel border-b border-r border-line px-3 py-1.5 text-left font-sans font-medium whitespace-nowrap cursor-pointer hover:bg-raised">
                <span className={pkColumns?.has(c) ? 'text-accent' : ''}>{c}</span>
                {sort?.column === c && (sort.dir === 'asc' ? <ArrowUp size={11} className="inline ml-1" /> : <ArrowDown size={11} className="inline ml-1" />)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} data-row={r} className={rowClassName(selection.selectedRows.has(r), selection.activeCell?.row === r)}>
              <td data-col={-1} title="Click to select the row (Ctrl to add, Shift for a range)"
                onClick={(e) => selectRow(r, { toggle: e.ctrlKey || e.metaKey, extend: e.shiftKey })}
                className={`border-b border-r border-line text-right px-2 py-1 cursor-pointer scroll-mt-8 hover:text-fg ${selection.selectedRows.has(r) ? 'text-accent' : 'text-dim'}`}>
                {r + 1}
              </td>
              {columns.map((c, ci) => {
                const isEditing = editing?.r === r && editing.c === c
                const isActive = selection.activeCell?.row === r && selection.activeCell.column === c
                const v = row[c]
                return (
                  // scroll-mt keeps keyboard-selected cells clear of the sticky header.
                  <td key={c} data-col={ci} onClick={() => selectCell({ row: r, column: c })}
                    onDoubleClick={() => startEditing({ row: r, column: c })}
                    className={`border-b border-r border-line px-3 py-1 max-w-[420px] truncate whitespace-nowrap scroll-mt-8 ${isActive ? 'outline outline-1 -outline-offset-1 outline-accent' : ''}`}>
                    {isEditing ? (
                      <div className="flex gap-1 -mx-2">
                        <input autoFocus className="field !py-0.5 font-mono" value={editing.v}
                          onChange={(e) => setEditing({ ...editing, v: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') commit(editing.v); if (e.key === 'Escape') stopEditing() }}
                          onBlur={() => setEditing(null)} />
                        <button className="btn !py-0 !px-1.5 text-dim" onMouseDown={(e) => { e.preventDefault(); commit(null) }}>NULL</button>
                      </div>
                    ) : v === null || v === undefined ? <span className="text-dim italic">NULL</span> : display(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="text-dim text-center py-10 font-sans">No rows</div>}
    </div>
  )
}
