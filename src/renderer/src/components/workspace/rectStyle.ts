import type { CSSProperties } from 'react'
import type { Rect } from '@/lib/paneGeometry'

/** CSS percentage of a fraction (0 to 1). */
export const percent = (fraction: number): string => `${fraction * 100}%`

/**
 * Absolute placement of a workspace area.
 *
 * @param rect - Area as fractions of the workspace.
 * @param topInset - CSS length cut from the top of the area (e.g. the pane's tab strip).
 */
export function rectStyle(rect: Rect, topInset?: string): CSSProperties {
  return {
    left: percent(rect.x),
    width: percent(rect.width),
    top: topInset ? `calc(${percent(rect.y)} + ${topInset})` : percent(rect.y),
    height: topInset ? `calc(${percent(rect.height)} - ${topInset})` : percent(rect.height),
  }
}

/** Height of a pane's tab strip in rem; pane views and drop zones start below it. */
export const TAB_STRIP_HEIGHT_REM = 3
export const TAB_STRIP_HEIGHT = `${TAB_STRIP_HEIGHT_REM}rem`
