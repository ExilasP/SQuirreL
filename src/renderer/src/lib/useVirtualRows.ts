import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'

/** Options of {@link useVirtualRows}. */
export interface VirtualRowsOptions {
  /** Scrollable element containing the rows (and the sticky header, if any). */
  containerRef: RefObject<HTMLElement | null>
  rowCount: number
  /** Initial row height guess in pixels, replaced by {@link VirtualRows.measureRow}. */
  estimatedRowHeight?: number
  /** Rows rendered above and below the viewport so that fast scrolling does not show blanks. */
  overscan?: number
}

/** Visible window returned by {@link useVirtualRows}. */
export interface VirtualRows {
  /** Index of the first rendered row. */
  start: number
  /** Index after the last rendered row. */
  end: number
  /** Height of the spacer standing for the rows above `start`. */
  paddingTop: number
  /** Height of the spacer standing for the rows from `end` on. */
  paddingBottom: number
  /** Reads the real height of a rendered row; pass a row with the default layout. */
  measureRow(element: HTMLElement | null): void
  /** Scrolls the container vertically just enough to show the given row below `headerHeight`. */
  scrollRowIntoView(row: number, headerHeight: number): void
}

const DEFAULT_ROW_HEIGHT = 27
const DEFAULT_OVERSCAN = 10

/**
 * Renders only the rows of a fixed-height list that intersect the viewport.
 *
 * Large query results would otherwise create one DOM row per record, which
 * freezes the renderer for tens of thousands of rows. Rows are assumed to
 * share the same height (cells do not wrap), so positions are computed
 * instead of measured row by row.
 */
export function useVirtualRows(options: VirtualRowsOptions): VirtualRows {
  const { containerRef, rowCount, estimatedRowHeight = DEFAULT_ROW_HEIGHT, overscan = DEFAULT_OVERSCAN } = options
  const [rowHeight, setRowHeight] = useState(estimatedRowHeight)
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 })

  useTrackViewport(containerRef, setViewport)

  const visibleRows = Math.ceil(viewport.height / rowHeight)
  const firstVisible = Math.floor(viewport.scrollTop / rowHeight)
  const start = Math.max(0, Math.min(firstVisible, rowCount) - overscan)
  const end = Math.min(rowCount, firstVisible + visibleRows + overscan)

  const measureRow = useCallback((element: HTMLElement | null) => {
    // Fractional heights matter: rounding errors add up over thousands of rows.
    const height = element?.getBoundingClientRect().height
    if (height && Math.abs(height - rowHeight) > 0.01) setRowHeight(height)
  }, [rowHeight])

  const scrollRowIntoView = useCallback((row: number, headerHeight: number) => {
    const container = containerRef.current
    if (!container) return
    const top = row * rowHeight
    const visibleHeight = container.clientHeight - headerHeight
    if (top < container.scrollTop) container.scrollTop = top
    else if (top + rowHeight > container.scrollTop + visibleHeight) container.scrollTop = top + rowHeight - visibleHeight
  }, [containerRef, rowHeight])

  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: (rowCount - end) * rowHeight,
    measureRow,
    scrollRowIntoView
  }
}

/**
 * Keeps the scroll offset and the height of the container in state. A shorter
 * result set clamps the scroll offset, which also fires a `scroll` event.
 */
function useTrackViewport(
  containerRef: RefObject<HTMLElement | null>,
  setViewport: (viewport: { scrollTop: number; height: number }) => void
): void {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => setViewport({ scrollTop: container.scrollTop, height: container.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    container.addEventListener('scroll', update, { passive: true })
    return () => { observer.disconnect(); container.removeEventListener('scroll', update) }
  }, [containerRef, setViewport])
}
