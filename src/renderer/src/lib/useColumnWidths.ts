import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { computeColumnWidths, type ColumnWidths, type MeasureText } from './columnWidths'

/** Width of the sort arrow (11px icon plus its 4px left margin). */
const SORT_ICON_WIDTH = 15

/**
 * Fixes the column widths of a virtualized grid for the whole page of rows.
 *
 * Widths are measured with the fonts and paddings actually applied to the
 * header cells, so they follow the stylesheet. They are recomputed when the
 * rows or columns change, and once web fonts have loaded.
 *
 * @param headerRef - The `<thead>`, whose cells carry `data-col` (`-1` for `#`).
 * @param columns - Column names, in display order.
 * @param rows - All the rows of the page, rendered or not.
 * @returns The widths, or `null` before the first layout.
 */
export function useColumnWidths(
  headerRef: RefObject<HTMLElement | null>,
  columns: string[],
  rows: Record<string, unknown>[]
): ColumnWidths | null {
  const [widths, setWidths] = useState<ColumnWidths | null>(null)
  const fontsVersion = useFontsLoaded()

  useLayoutEffect(() => {
    const header = headerRef.current
    const indexCell = header?.querySelector<HTMLElement>('[data-col="-1"]')
    if (!header || !indexCell) return
    const valueCell = header.querySelector<HTMLElement>('[data-col="0"]')
    const measureValue = textMeasurer(fontOf(indexCell))
    const measureHeader = textMeasurer(valueCell ? fontOf(valueCell) : fontOf(indexCell))
    setWidths(computeColumnWidths(columns, rows, measureValue, measureHeader, {
      valueCell: valueCell ? horizontalChrome(valueCell) : 0,
      indexCell: horizontalChrome(indexCell),
      sortIcon: SORT_ICON_WIDTH
    }))
  }, [headerRef, columns, rows, fontsVersion])

  return widths
}

/** Counts web font load completions, so that measures made with fallback fonts get redone. */
function useFontsLoaded(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let isMounted = true
    document.fonts?.ready.then(() => { if (isMounted) setVersion((v) => v + 1) })
    return () => { isMounted = false }
  }, [])
  return version
}

/** CSS `font` shorthand of an element, rebuilt from its longhands for canvas use. */
function fontOf(element: HTMLElement): string {
  const style = getComputedStyle(element)
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
}

/** Padding plus borders on the left and right of an element. */
function horizontalChrome(element: HTMLElement): number {
  const style = getComputedStyle(element)
  return [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]
    .reduce((total, value) => total + (parseFloat(value) || 0), 0)
}

let measuringContext: CanvasRenderingContext2D | null = null

/** Returns a function measuring texts in the given font, through a shared off-screen canvas. */
function textMeasurer(font: string): MeasureText {
  measuringContext ??= document.createElement('canvas').getContext('2d')
  return (text) => {
    if (!measuringContext || !text) return 0
    measuringContext.font = font
    return measuringContext.measureText(text).width
  }
}
