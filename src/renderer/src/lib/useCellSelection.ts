import { useEffect, useState, type KeyboardEvent } from 'react'
import { display } from './format'
import { matchesShortcut } from './shortcuts'

/** Position of a grid cell: row index and column name. */
export interface CellPosition {
  row: number
  column: string
}

/** State and handlers returned by {@link useCellSelection}. */
export interface CellSelection {
  activeCell: CellPosition | null
  selectCell(cell: CellPosition): void
  /** Keyboard handler to attach to the focusable grid container. */
  onKeyDown(event: KeyboardEvent<HTMLElement>): void
}

/**
 * Tracks the selected cell of a grid and copies its value on Ctrl/Cmd+C.
 *
 * The selection is cleared whenever `rows` changes (new page, sort, refresh)
 * so it never points at a different record than the one the user clicked.
 *
 * @param rows - Rows currently displayed by the grid.
 * @returns The active cell, a setter and the container's key handler.
 */
export function useCellSelection(rows: Record<string, unknown>[]): CellSelection {
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null)

  useEffect(() => setActiveCell(null), [rows])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Leave native copy alone inside the inline editor input.
    if (event.target instanceof HTMLInputElement) return
    if (!activeCell || !matchesShortcut(event.nativeEvent, 'Mod+C')) return
    const row = rows[activeCell.row]
    if (!row) return
    event.preventDefault()
    void navigator.clipboard.writeText(display(row[activeCell.column]))
  }

  return { activeCell, selectCell: setActiveCell, onKeyDown }
}
