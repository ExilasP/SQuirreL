import type { SplitEdge } from './panes'
import type { Rect } from './paneGeometry'

/** What dropping a tab on a pane does: join its strip, or split it on one edge. */
export type PaneDropTarget = { kind: 'center' } | { kind: 'edge'; edge: SplitEdge }

/** Pointer and pane measurements needed to pick a drop target. */
export interface PaneDropContext {
  /** Pointer position inside the pane, as fractions of its width and height. */
  x: number
  y: number
  /** Pane size in pixels, to check that both halves of a split stay usable. */
  widthPx: number
  heightPx: number
  minWidthPx: number
  minHeightPx: number
  /** Whether the dragged tab may split this pane at all (see `canSplitWith`). */
  canSplit: boolean
}

/** Band along each edge, as a fraction of the pane, where a drop splits instead of joining. */
const EDGE_BAND = 0.25

/**
 * Picks what dropping a tab at the pointer would do on a pane.
 *
 * The nearest edge wins when the pointer is in its band; an edge whose split would leave a
 * pane below the minimum size is ignored, so the drop joins the pane instead.
 *
 * @param context - Pointer position, pane size and split permission.
 */
export function dropTargetAt(context: PaneDropContext): PaneDropTarget {
  if (!context.canSplit) return { kind: 'center' }
  const distances: Record<SplitEdge, number> = { left: context.x, right: 1 - context.x, top: context.y, bottom: 1 - context.y }
  const canSplitAcross = context.widthPx / 2 >= context.minWidthPx
  const canSplitDown = context.heightPx / 2 >= context.minHeightPx
  const candidates = (Object.keys(distances) as SplitEdge[])
    .filter((edge) => distances[edge] <= EDGE_BAND)
    .filter((edge) => (edge === 'left' || edge === 'right' ? canSplitAcross : canSplitDown))
    .sort((a, b) => distances[a] - distances[b])
  return candidates.length > 0 ? { kind: 'edge', edge: candidates[0] } : { kind: 'center' }
}

const EDGE_PREVIEW: Record<SplitEdge, Rect> = {
  left: { x: 0, y: 0, width: 0.5, height: 1 },
  right: { x: 0.5, y: 0, width: 0.5, height: 1 },
  top: { x: 0, y: 0, width: 1, height: 0.5 },
  bottom: { x: 0, y: 0.5, width: 1, height: 0.5 },
}

/** Part of the pane the dropped tab would take, as fractions of the pane, to preview the drop. */
export function dropPreviewRect(target: PaneDropTarget): Rect {
  return target.kind === 'edge' ? EDGE_PREVIEW[target.edge] : { x: 0, y: 0, width: 1, height: 1 }
}
