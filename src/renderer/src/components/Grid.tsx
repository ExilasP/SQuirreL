import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { display } from '@/lib/format'
import { CellEditor } from './CellEditor'
import { useGridSelection } from '@/lib/useGridSelection'
import { useVirtualRows } from '@/lib/useVirtualRows'
import type { CellPosition, RowSelectMode } from '@/lib/gridSelection'

interface Props {
  columns: string[]
  rows: Record<string, unknown>[]
  pkColumns?: Set<string>
  /** Columns that accept `NULL`; the editor offers a NULL button only for these. */
  nullableColumns?: Set<string>
  /** Allowed values of enum columns, keyed by column name; edited with a drop-down. */
  enumValuesByColumn?: Map<string, string[]>
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

export function Grid({ columns, rows, pkColumns, nullableColumns, enumValuesByColumn, sort, onSort, onEdit, selectionResetKey, onSelectedRowsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLTableSectionElement>(null)
  const [editing, setEditing] = useState<EditingCell | null>(null)

  const startEditing = ({ row, column }: CellPosition) => {
    if (!onEdit) return
    const value = rows[row][column]
    setEditing({ r: row, c: column, v: value === null ? '' : display(value) })
  }
  const virtualRows = useVirtualRows({ containerRef, rowCount: rows.length })
  const scrollRowIntoView = (row: number) => virtualRows.scrollRowIntoView(row, headerRef.current?.offsetHeight ?? 0)
  const { selection, selectCell, selectRow, onKeyDown } = useGridSelection({
    columns, rows, containerRef, scrollRowIntoView, resetKey: selectionResetKey, onEditCell: startEditing, onSelectedRowsChange
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
        <thead ref={headerRef} className="sticky top-0 z-10">
          <tr>
            <th data-col={-1} className="w-10 bg-panel border-b border-r border-line text-dim text-right px-2 py-1.5 font-normal">#</th>
            {columns.map((c, ci) => (
              <th key={c} data-col={ci} onClick={() => onSort?.(c)} className="bg-panel border-b border-r border-line px-3 py-1.5 text-left font-sans font-medium whitespace-nowrap cursor-pointer hover:bg-raised">
                <span className={pkColumns?.has(c) ? 'text-accent' : ''}>{c}</span>
                {sort?.column === c && (sort.dir === 'asc' ? <ArrowUp size={11} className="inline ml-1" /> : <ArrowDown size={11} className="inline ml-1" />)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SpacerRow height={virtualRows.paddingTop} columnCount={columns.length + 1} />
          {rows.slice(virtualRows.start, virtualRows.end).map((row, offset) => {
            const r = virtualRows.start + offset
            const rowEditing = editing?.r === r ? editing : null
            return (
              <GridRow key={r} row={row} rowIndex={r} columns={columns} nullableColumns={nullableColumns} enumValuesByColumn={enumValuesByColumn}
                isSelected={selection.selectedRows.has(r)}
                activeColumn={selection.activeCell?.row === r ? selection.activeCell.column : null}
                editing={rowEditing}
                // The first rendered row gives the height of all rows, unless its editor makes it taller.
                rowRef={offset === 0 && !rowEditing ? virtualRows.measureRow : undefined}
                onSelectRow={selectRow} onSelectCell={selectCell} onStartEditing={startEditing}
                onEditValueChange={(v) => setEditing({ ...editing!, v })} onCommit={commit} onCancelEditing={stopEditing}
                onBlurEditor={() => setEditing(null)} />
            )
          })}
          <SpacerRow height={virtualRows.paddingBottom} columnCount={columns.length + 1} />
        </tbody>
      </table>
      {rows.length === 0 && <div className="text-dim text-center py-10 font-sans">No rows</div>}
    </div>
  )
}

/** Value being typed in the inline editor of a cell. */
interface EditingCell { r: number; c: string; v: string }

interface GridRowProps {
  row: Record<string, unknown>
  rowIndex: number
  columns: string[]
  nullableColumns?: Set<string>
  enumValuesByColumn?: Map<string, string[]>
  isSelected: boolean
  /** Column of the active cell when it lies in this row. */
  activeColumn: string | null
  /** Editor state when a cell of this row is being edited. */
  editing: EditingCell | null
  rowRef?(element: HTMLElement | null): void
  onSelectRow(row: number, mode: RowSelectMode): void
  onSelectCell(cell: CellPosition): void
  onStartEditing(cell: CellPosition): void
  onEditValueChange(value: string): void
  onCommit(value: unknown): void
  onCancelEditing(): void
  onBlurEditor(): void
}

/** One body row of the grid: the `#` cell followed by the value cells. */
function GridRow(props: GridRowProps) {
  const { row, rowIndex: r, columns, nullableColumns, enumValuesByColumn, isSelected, activeColumn, editing, rowRef } = props
  return (
    <tr data-row={r} ref={rowRef} className={rowClassName(isSelected, activeColumn !== null)}>
      <td data-col={-1} title="Click to select the row (Ctrl to add, Shift for a range)"
        onClick={(e) => props.onSelectRow(r, { toggle: e.ctrlKey || e.metaKey, extend: e.shiftKey })}
        className={`border-b border-r border-line text-right px-2 py-1 cursor-pointer hover:text-fg ${isSelected ? 'text-accent' : 'text-dim'}`}>
        {r + 1}
      </td>
      {columns.map((c, ci) => {
        const v = row[c]
        return (
          <td key={c} data-col={ci} onClick={() => props.onSelectCell({ row: r, column: c })}
            onDoubleClick={() => props.onStartEditing({ row: r, column: c })}
            className={`border-b border-r border-line px-3 py-1 max-w-[420px] truncate whitespace-nowrap ${activeColumn === c ? 'outline outline-1 -outline-offset-1 outline-accent' : ''}`}>
            {editing?.c === c ? (
              <CellEditor value={editing.v} enumValues={enumValuesByColumn?.get(c)} isNullable={nullableColumns?.has(c) ?? false} onChange={props.onEditValueChange}
                onCommit={props.onCommit} onCancel={props.onCancelEditing} onBlur={props.onBlurEditor} />
            ) : v === null || v === undefined ? <span className="text-dim italic">NULL</span> : display(v)}
          </td>
        )
      })}
    </tr>
  )
}

/** Empty row standing for the rows that are scrolled out of view. */
function SpacerRow({ height, columnCount }: { height: number; columnCount: number }) {
  if (height <= 0) return null
  return <tr aria-hidden><td colSpan={columnCount} className="p-0 border-0" style={{ height }} /></tr>
}
