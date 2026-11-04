import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { ARROW_MOVES, EMPTY_SELECTION, moveCell, selectCell, selectionToText, type CellPosition, type GridSelection } from './gridSelection'
import { matchesShortcut } from './shortcuts'

/** Options of {@link useGridSelection}. */
export interface GridSelectionOptions {
  columns: string[]
  rows: Record<string, unknown>[]
  /** Scrollable grid container, used to keep the selection in view. */
  containerRef: RefObject<HTMLElement | null>
  /** Called on Enter to start editing the active cell. */
  onEditCell?(cell: CellPosition): void
}

/** State and handlers returned by {@link useGridSelection}. */
export interface GridSelectionHandle {
  selection: GridSelection
  selectCell(cell: CellPosition): void
  /** Keyboard handler to attach to the focusable grid container. */
  onKeyDown(event: KeyboardEvent<HTMLElement>): void
}

const hasModifier = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey || event.altKey

/**
 * Keyboard and mouse selection for a result grid: arrow-key navigation,
 * Enter to edit and Ctrl/Cmd+C to copy.
 *
 * The selection is cleared whenever `rows` changes (new page, sort, refresh)
 * so it never points at a different record than the one the user picked.
 */
export function useGridSelection({ columns, rows, containerRef, onEditCell }: GridSelectionOptions): GridSelectionHandle {
  const [selection, setSelection] = useState<GridSelection>(EMPTY_SELECTION)

  useEffect(() => setSelection(EMPTY_SELECTION), [rows])
  useEffect(() => scrollCellIntoView(containerRef.current, selection.activeCell, columns), [selection, columns, containerRef])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // The inline editor input keeps its native keyboard behaviour.
    if (event.target instanceof HTMLInputElement) return
    if (matchesShortcut(event.nativeEvent, 'Mod+C')) {
      const text = selectionToText(selection, rows)
      if (text === null) return
      event.preventDefault()
      void navigator.clipboard.writeText(text)
      return
    }
    if (event.key === 'Escape') { setSelection(EMPTY_SELECTION); return }
    if (event.key === 'Enter' && selection.activeCell && onEditCell) {
      event.preventDefault(); onEditCell(selection.activeCell); return
    }
    const delta = ARROW_MOVES[event.key]
    if (!delta || hasModifier(event)) return
    event.preventDefault()
    setSelection(moveCell(selection, delta, columns, rows.length))
  }

  return { selection, selectCell: (cell) => setSelection(selectCell(cell)), onKeyDown }
}

function scrollCellIntoView(container: HTMLElement | null, cell: CellPosition | null, columns: string[]): void {
  if (!container || !cell) return
  const element = container.querySelector(`[data-row="${cell.row}"] [data-col="${columns.indexOf(cell.column)}"]`)
  element?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
