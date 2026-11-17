import type { ElementSize } from './useElementSize'

/** Narrowest a pane may get, so its tab strip and toolbars stay usable. */
const MIN_PANE_WIDTH_REM = 20
/** Shortest a pane may get, tab strip included, so a query view keeps room for its editor and results. */
const MIN_PANE_HEIGHT_REM = 15

/** Size of one `rem` in pixels, which follows the root font size (and so the zoom level). */
export function remToPx(rem: number): number {
  return rem * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
}

/**
 * Minimum pane size in pixels.
 *
 * Enforced when splitting and resizing; a shrinking window may still squeeze panes below it.
 */
export function minPaneSizePx(): ElementSize {
  return { width: remToPx(MIN_PANE_WIDTH_REM), height: remToPx(MIN_PANE_HEIGHT_REM) }
}
