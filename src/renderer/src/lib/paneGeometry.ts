import type { LayoutNode, PaneNode, SplitDirection } from './panes'

/** Area of the workspace, as fractions of its width and height (0 to 1). */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** A pane and the area it occupies. */
export interface PaneBox {
  pane: PaneNode
  rect: Rect
}

/** Draggable boundary between two neighbouring children of a split. */
export interface Divider {
  splitId: string
  /** Index of the child before the boundary. */
  boundary: number
  direction: SplitDirection
  /** Shares of all the split's children, to compute a resize from. */
  sizes: number[]
  /** Area of the whole split, to convert a drag distance into a share of it. */
  splitRect: Rect
  /** Position of the boundary along the split's direction, as a fraction of the workspace. */
  offset: number
}

/** Placement of every pane and divider of a layout. */
export interface Geometry {
  panes: PaneBox[]
  dividers: Divider[]
}

const FULL_AREA: Rect = { x: 0, y: 0, width: 1, height: 1 }

/** Cuts `rect` into consecutive slices along `direction`, one per share. */
function sliceRect(rect: Rect, direction: SplitDirection, sizes: readonly number[]): Rect[] {
  let start = 0
  return sizes.map((size) => {
    const slice = direction === 'row'
      ? { ...rect, x: rect.x + rect.width * start, width: rect.width * size }
      : { ...rect, y: rect.y + rect.height * start, height: rect.height * size }
    start += size
    return slice
  })
}

/**
 * Computes where each pane and divider of a layout tree sits in the workspace.
 *
 * @param root - Root of the layout tree.
 * @param area - Area given to `root`; the whole workspace by default.
 * @returns Pane boxes in reading order, and the dividers between neighbouring children.
 */
export function computeGeometry(root: LayoutNode, area: Rect = FULL_AREA): Geometry {
  if (root.kind === 'pane') return { panes: [{ pane: root, rect: area }], dividers: [] }

  const slices = sliceRect(area, root.direction, root.sizes)
  const children = root.children.map((child, i) => computeGeometry(child, slices[i]))
  const dividers: Divider[] = slices.slice(1).map((slice, i) => ({
    splitId: root.id, boundary: i, direction: root.direction, sizes: root.sizes, splitRect: area,
    offset: root.direction === 'row' ? slice.x : slice.y,
  }))
  return {
    panes: children.flatMap((c) => c.panes),
    dividers: [...dividers, ...children.flatMap((c) => c.dividers)],
  }
}
