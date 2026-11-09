import { useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from 'react'
import {
  ARROW_MOVES, EMPTY_SELECTION, moveCell, retainActiveCell, moveRow, selectAllRows, selectCell, selectRow, selectedRowIndices, selectionToText,
  type CellPosition, type GridSelection, type RowSelectMode
} from './gridSelection'
import { matchesShortcut } from './shortcuts'

/** Options of {@link useGridSelection}. */
export interface GridSelectionOptions {
  columns: string[]
  rows: Record<string, unknown>[]
  /** Scrollable grid container, used to keep the selection in view. */
  containerRef: RefObject<HTMLElement | null>
  /**
   * Scrolls a row into view vertically. Needed because a virtualized grid
   * does not render the target row until it has been scrolled to.
   */
  scrollRowIntoView(row: number): void
  /**
   * Clears the selection when it changes (page, sort, filter…). Without it
   * every new `rows` array clears it; with it, a reload keeps the active cell.
   */
  resetKey?: unknown
  /** Called on Enter to start editing the active cell. */
  onEditCell?(cell: CellPosition): void
  /** Called with the indices of the rows the selection applies to whenever they change. */
  onSelectedRowsChange?(rows: number[]): void
}

/** State and handlers returned by {@link useGridSelection}. */
export interface GridSelectionHandle {
  selection: GridSelection
  selectCell(cell: CellPosition): void
  selectRow(row: number, mode: RowSelectMode): void
  /** Keyboard handler to attach to the focusable grid container. */
  onKeyDown(event: KeyboardEvent<HTMLElement>): void
}

const hasModifier = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey || event.altKey

/**
 * Keyboard and mouse selection for a result grid: a single cell or several
 * whole rows, arrow-key navigation, Enter to edit, Ctrl/Cmd+A to select all
 * rows and Ctrl/Cmd+C to copy.
 *
 * The selection is cleared when `resetKey` (or, without one, `rows`) changes
 * so it never points at a different record than the one the user picked.
 */
export function useGridSelection(options: GridSelectionOptions): GridSelectionHandle {
  const { columns, rows, containerRef, scrollRowIntoView, resetKey, onEditCell, onSelectedRowsChange } = options
  const [selection, setSelection] = useState<GridSelection>(EMPTY_SELECTION)
  const selectedRows = useMemo(() => selectedRowIndices(selection), [selection])

  useEffect(() => setSelection(EMPTY_SELECTION), [resetKey ?? rows])
  useEffect(() => setSelection((current) => retainActiveCell(current, rows.length)), [rows])
  useEffect(() => onSelectedRowsChange?.(selectedRows), [selectedRows, onSelectedRowsChange])
  useEffect(() => {
    const row = selection.activeCell?.row ?? selection.leadRow
    if (row !== null) scrollRowIntoView(row)
    if (selection.activeCell) scrollColumnIntoView(containerRef.current, columns.indexOf(selection.activeCell.column))
    // Only a selection change should scroll, not a re-created callback (e.g. after a row height measure).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection])

  const copySelection = (event: KeyboardEvent<HTMLElement>) => {
    const text = selectionToText(selection, rows, columns)
    if (text === null) return
    event.preventDefault()
    void navigator.clipboard.writeText(text)
  }

  const moveWithArrow = (event: KeyboardEvent<HTMLElement>) => {
    const delta = ARROW_MOVES[event.key]
    if (!delta || hasModifier(event)) return
    event.preventDefault()
    const isRowMode = !selection.activeCell && selection.selectedRows.size > 0 && delta.rows !== 0
    setSelection(isRowMode
      ? moveRow(selection, delta.rows, event.shiftKey, rows.length)
      : moveCell(selection, delta, columns, rows.length))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // The inline editor (text input or enum select) keeps its native keyboard behaviour.
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    if (matchesShortcut(event.nativeEvent, 'Mod+C')) { copySelection(event); return }
    if (matchesShortcut(event.nativeEvent, 'Mod+A')) { event.preventDefault(); setSelection(selectAllRows(rows.length)); return }
    if (event.key === 'Escape') { setSelection(EMPTY_SELECTION); return }
    if (event.key === 'Enter' && selection.activeCell && onEditCell) {
      event.preventDefault(); onEditCell(selection.activeCell); return
    }
    moveWithArrow(event)
  }

  return {
    selection,
    selectCell: (cell) => setSelection(selectCell(cell)),
    selectRow: (row, mode) => setSelection((current) => selectRow(current, row, mode)),
    onKeyDown
  }
}

/**
 * Scrolls the container horizontally just enough to show a column. Uses the
 * header cell, which is always rendered, unlike the body cells of a virtualized grid.
 */
function scrollColumnIntoView(container: HTMLElement | null, columnIndex: number): void {
  const header = container?.querySelector<HTMLElement>(`thead [data-col="${columnIndex}"]`)
  if (!container || !header) return
  const left = header.offsetLeft
  const right = left + header.offsetWidth
  if (left < container.scrollLeft) container.scrollLeft = left
  else if (right > container.scrollLeft + container.clientWidth) container.scrollLeft = right - container.clientWidth
}
