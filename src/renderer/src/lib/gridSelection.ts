import { display } from './format'

/** Position of a grid cell: row index and column name. */
export interface CellPosition {
  row: number
  column: string
}

/** Selection state of a result grid. */
export interface GridSelection {
  activeCell: CellPosition | null
}

/** Selection with nothing selected. */
export const EMPTY_SELECTION: GridSelection = { activeCell: null }

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

/** Selects a single cell. */
export function selectCell(cell: CellPosition): GridSelection {
  return { activeCell: cell }
}

/**
 * Moves the active cell, staying inside the grid.
 *
 * @param selection - Current selection; with no active cell the first cell is selected.
 * @param delta - Offsets to apply.
 * @param columns - Displayed columns, in order.
 * @param rowCount - Number of displayed rows.
 * @returns The new selection, unchanged if the grid is empty.
 */
export function moveCell(selection: GridSelection, delta: MoveDelta, columns: string[], rowCount: number): GridSelection {
  if (!columns.length || !rowCount) return selection
  const start = selection.activeCell
  if (!start) return selectCell({ row: 0, column: columns[0] })
  const columnIndex = clampIndex(columns.indexOf(start.column) + delta.columns, columns.length)
  return selectCell({ row: clampIndex(start.row + delta.rows, rowCount), column: columns[columnIndex] })
}

/**
 * Text to put in the clipboard for the current selection.
 *
 * @returns The selected value as displayed, or `null` when nothing is selected.
 */
export function selectionToText(selection: GridSelection, rows: Record<string, unknown>[]): string | null {
  const cell = selection.activeCell
  const row = cell && rows[cell.row]
  return row ? display(row[cell.column]) : null
}
