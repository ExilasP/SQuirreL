import { display, toTsv } from './format'

/** Position of a grid cell: row index and column name. */
export interface CellPosition {
  row: number
  column: string
}

/**
 * Selection state of a result grid: either a single active cell or a set of
 * whole rows picked from the `#` column, never both.
 */
export interface GridSelection {
  activeCell: CellPosition | null
  selectedRows: ReadonlySet<number>
  /** Row a Shift range starts from (last plain or Ctrl click). */
  anchorRow: number | null
  /** Moving end of the row selection, driven by Shift+click and the arrow keys. */
  leadRow: number | null
}

/** Selection with nothing selected. */
export const EMPTY_SELECTION: GridSelection = { activeCell: null, selectedRows: new Set(), anchorRow: null, leadRow: null }

/** How a row click combines with the current selection. */
export interface RowSelectMode {
  /** Ctrl/Cmd: add or remove the row, keeping the others. */
  toggle: boolean
  /** Shift: select the range from the anchor row. */
  extend: boolean
}

/** Row and column offsets of a keyboard move. */
export interface MoveDelta {
  rows: number
  columns: number
}

/** Arrow keys mapped to the move they trigger. */
export const ARROW_MOVES: Readonly<Record<string, MoveDelta>> = {
  ArrowUp: { rows: -1, columns: 0 },
  ArrowDown: { rows: 1, columns: 0 },
  ArrowLeft: { rows: 0, columns: -1 },
  ArrowRight: { rows: 0, columns: 1 }
}

const clampIndex = (index: number, length: number): number => Math.min(Math.max(index, 0), length - 1)

const rowRange = (from: number, to: number): number[] =>
  Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => Math.min(from, to) + i)

/** Selects a single cell, dropping any row selection. */
export function selectCell(cell: CellPosition): GridSelection {
  return { ...EMPTY_SELECTION, activeCell: cell }
}

/**
 * Keeps the active cell after the rows were reloaded in place (e.g. after an
 * edit), if it is still inside the grid. Row selections are dropped since the
 * rows they pointed at may have moved or been deleted.
 */
export function retainActiveCell(selection: GridSelection, rowCount: number): GridSelection {
  const cell = selection.activeCell
  return cell && cell.row < rowCount ? selectCell(cell) : EMPTY_SELECTION
}

/**
 * Applies a click on a row header, spreadsheet style.
 *
 * @param selection - Current selection.
 * @param row - Clicked row index.
 * @param mode - Modifier keys held during the click.
 * @returns The new selection, with no active cell.
 */
export function selectRow(selection: GridSelection, row: number, { toggle, extend }: RowSelectMode): GridSelection {
  if (extend && selection.anchorRow !== null) {
    const range = rowRange(selection.anchorRow, row)
    const selectedRows = new Set(toggle ? [...selection.selectedRows, ...range] : range)
    return { activeCell: null, selectedRows, anchorRow: selection.anchorRow, leadRow: row }
  }
  if (toggle) {
    const selectedRows = new Set(selection.selectedRows)
    if (!selectedRows.delete(row)) selectedRows.add(row)
    return { activeCell: null, selectedRows, anchorRow: row, leadRow: row }
  }
  return { activeCell: null, selectedRows: new Set([row]), anchorRow: row, leadRow: row }
}

/** Selects every displayed row. */
export function selectAllRows(rowCount: number): GridSelection {
  if (!rowCount) return EMPTY_SELECTION
  return { activeCell: null, selectedRows: new Set(rowRange(0, rowCount - 1)), anchorRow: 0, leadRow: rowCount - 1 }
}

/**
 * Moves the active cell, staying inside the grid.
 *
 * @param selection - Current selection; with no active cell, the first cell of the lead row (or of the grid) is selected.
 * @param delta - Offsets to apply.
 * @param columns - Displayed columns, in order.
 * @param rowCount - Number of displayed rows.
 * @returns The new selection, unchanged if the grid is empty.
 */
export function moveCell(selection: GridSelection, delta: MoveDelta, columns: string[], rowCount: number): GridSelection {
  if (!columns.length || !rowCount) return selection
  const start = selection.activeCell
  if (!start) return selectCell({ row: clampIndex(selection.leadRow ?? 0, rowCount), column: columns[0] })
  const columnIndex = clampIndex(columns.indexOf(start.column) + delta.columns, columns.length)
  return selectCell({ row: clampIndex(start.row + delta.rows, rowCount), column: columns[columnIndex] })
}

/**
 * Moves the lead of a row selection up or down.
 *
 * @param extend - Shift held: grow the range from the anchor instead of selecting a single row.
 */
export function moveRow(selection: GridSelection, rows: number, extend: boolean, rowCount: number): GridSelection {
  if (!rowCount) return selection
  const lead = clampIndex((selection.leadRow ?? 0) + rows, rowCount)
  return selectRow(selection, lead, { toggle: false, extend })
}

/**
 * Rows the selection applies to, in display order: the selected rows, or the
 * row of the active cell.
 */
export function selectedRowIndices(selection: GridSelection): number[] {
  if (selection.activeCell) return [selection.activeCell.row]
  return [...selection.selectedRows].sort((a, b) => a - b)
}

/**
 * Text to put in the clipboard for the current selection.
 *
 * @returns The active cell's value, the selected rows as TSV (no header), or `null` when nothing is selected.
 */
export function selectionToText(selection: GridSelection, rows: Record<string, unknown>[], columns: string[]): string | null {
  const cell = selection.activeCell
  if (cell) {
    const row = rows[cell.row]
    return row ? display(row[cell.column]) : null
  }
  const picked = selectedRowIndices(selection).map((i) => rows[i]).filter(Boolean)
  return picked.length ? toTsv(columns, picked) : null
}
