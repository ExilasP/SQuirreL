import { moveItem } from './reorder'

/** `row` lays children side by side, `column` stacks them. */
export type SplitDirection = 'row' | 'column'

/** Edge of a pane a dragged tab is dropped on to split it. */
export type SplitEdge = 'left' | 'right' | 'top' | 'bottom'

/** Leaf of the layout: a tab strip and the view of its active tab. */
export interface PaneNode {
  kind: 'pane'
  id: string
  /** Ids of the tabs shown in this pane, in tab strip order. */
  tabIds: string[]
  activeTabId: string | null
}

/** Node dividing its area between children along one direction. */
export interface SplitNode {
  kind: 'split'
  id: string
  direction: SplitDirection
  /** At least two children; never a split of the same direction (it is flattened into this one). */
  children: LayoutNode[]
  /** Share of the area given to each child, in the same order; sums to 1. */
  sizes: number[]
}

export type LayoutNode = PaneNode | SplitNode

/**
 * How open tabs are spread over the workspace: a tree of splits whose leaves are panes.
 *
 * Invariant: no pane is empty, except a root pane when no tab is open.
 */
export interface Layout {
  root: LayoutNode
  /** Pane receiving new tabs and keyboard shortcuts. */
  focusedPaneId: string
}

const createId = (): string => crypto.randomUUID()

const createPane = (tabIds: string[] = []): PaneNode => ({ kind: 'pane', id: createId(), tabIds, activeTabId: tabIds[0] ?? null })

/** Layout with a single, empty pane. */
export function createEmptyLayout(): Layout {
  const pane = createPane()
  return { root: pane, focusedPaneId: pane.id }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Every pane of the tree, in reading order (left to right, top to bottom). */
export function listPanes(node: LayoutNode): PaneNode[] {
  return node.kind === 'pane' ? [node] : node.children.flatMap(listPanes)
}

/** Pane with the given id, if any. */
export function findPane(layout: Layout, paneId: string): PaneNode | undefined {
  return listPanes(layout.root).find((p) => p.id === paneId)
}

/** Pane holding `tabId`, if the tab is open. */
export function paneOf(layout: Layout, tabId: string): PaneNode | undefined {
  return listPanes(layout.root).find((p) => p.tabIds.includes(tabId))
}

/** Active tab of the focused pane. */
export function activeTabId(layout: Layout): string | null {
  return findPane(layout, layout.focusedPaneId)?.activeTabId ?? null
}

// ---------------------------------------------------------------------------
// Tree plumbing
// ---------------------------------------------------------------------------

/** Rebuilds the tree bottom-up, replacing each node by what `transform` returns for it. */
function mapTree(node: LayoutNode, transform: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (node.kind === 'pane') return transform(node)
  return transform({ ...node, children: node.children.map((child) => mapTree(child, transform)) })
}

function updatePane(layout: Layout, paneId: string, update: (pane: PaneNode) => PaneNode): Layout {
  const root = mapTree(layout.root, (node) => (node.kind === 'pane' && node.id === paneId ? update(node) : node))
  return { ...layout, root }
}

/**
 * Restores the tree invariants after an edit: drops empty panes, dissolves splits left with a
 * single child, and flattens a split nested in a split of the same direction.
 *
 * @returns The normalized node, or `null` when nothing is left of it.
 */
function normalize(node: LayoutNode): LayoutNode | null {
  if (node.kind === 'pane') return node.tabIds.length > 0 ? node : null

  const kept = node.children
    .map((child, i) => ({ node: normalize(child), size: node.sizes[i] }))
    .filter((entry): entry is { node: LayoutNode; size: number } => entry.node !== null)
  if (kept.length === 0) return null
  if (kept.length === 1) return kept[0].node

  // A same-direction child splits its share among its own children.
  const flattened = kept.flatMap(({ node: child, size }) =>
    child.kind === 'split' && child.direction === node.direction
      ? child.children.map((grandChild, i) => ({ node: grandChild, size: size * child.sizes[i] }))
      : [{ node: child, size }])
  // Space freed by removed children goes to the others, in proportion.
  const total = flattened.reduce((sum, entry) => sum + entry.size, 0)
  return { ...node, children: flattened.map((e) => e.node), sizes: flattened.map((e) => e.size / total) }
}

/** Normalizes the tree and keeps the focus on an existing pane (`preferredFocus` if it survived). */
function withNormalizedRoot(layout: Layout, preferredFocus = layout.focusedPaneId): Layout {
  const root = normalize(layout.root)
  if (!root) return createEmptyLayout()
  const panes = listPanes(root)
  const focusedPaneId = panes.some((p) => p.id === preferredFocus) ? preferredFocus : panes[0].id
  return { root, focusedPaneId }
}

/** Removes `tabId` from its pane, activating a neighbour if it was active; may leave the pane empty. */
function detach(layout: Layout, tabId: string): Layout {
  const source = paneOf(layout, tabId)
  if (!source) return layout
  return updatePane(layout, source.id, (pane) => {
    const position = pane.tabIds.indexOf(tabId)
    const tabIds = pane.tabIds.filter((id) => id !== tabId)
    const activeId = pane.activeTabId === tabId ? (tabIds[Math.min(position, tabIds.length - 1)] ?? null) : pane.activeTabId
    return { ...pane, tabIds, activeTabId: activeId }
  })
}

/** Inserts `tabId` in a pane at `position` (end by default), activating and focusing it. */
function attach(layout: Layout, tabId: string, paneId: string, position?: number): Layout {
  const updated = updatePane(layout, paneId, (pane) => {
    const tabIds = [...pane.tabIds]
    tabIds.splice(position ?? tabIds.length, 0, tabId)
    return { ...pane, tabIds, activeTabId: tabId }
  })
  return { ...updated, focusedPaneId: paneId }
}

// ---------------------------------------------------------------------------
// Tab operations
// ---------------------------------------------------------------------------

/**
 * Shows `tabId`: focuses it if already open, otherwise appends it to the focused pane.
 *
 * @param layout - Current layout.
 * @param tabId - Tab to show.
 */
export function openTabIn(layout: Layout, tabId: string): Layout {
  return paneOf(layout, tabId) ? activateTab(layout, tabId) : attach(layout, tabId, layout.focusedPaneId)
}

/** Makes `tabId` the active tab of its pane and focuses that pane. */
export function activateTab(layout: Layout, tabId: string): Layout {
  const pane = paneOf(layout, tabId)
  if (!pane) return layout
  return { ...updatePane(layout, pane.id, (p) => ({ ...p, activeTabId: tabId })), focusedPaneId: pane.id }
}

/** Focuses the given pane, if it exists. */
export function focusPane(layout: Layout, paneId: string): Layout {
  return findPane(layout, paneId) ? { ...layout, focusedPaneId: paneId } : layout
}

/**
 * Closes the given tabs; panes left empty disappear and their space goes to their neighbours.
 *
 * @param layout - Current layout.
 * @param tabIds - Tabs to close; unknown ids are ignored.
 */
export function closeTabsIn(layout: Layout, tabIds: readonly string[]): Layout {
  return withNormalizedRoot(tabIds.reduce(detach, layout))
}

/**
 * Moves `tabId` to `position` in a pane's strip (reorder within a pane, or move across panes).
 *
 * @param layout - Current layout.
 * @param tabId - Tab being dragged.
 * @param paneId - Destination pane.
 * @param position - Final index of the tab in the destination strip.
 */
export function moveTabTo(layout: Layout, tabId: string, paneId: string, position: number): Layout {
  const source = paneOf(layout, tabId)
  if (!source || !findPane(layout, paneId)) return layout
  if (source.id === paneId) {
    const reordered = updatePane(layout, paneId, (pane) => ({ ...pane, tabIds: moveItem(pane.tabIds, pane.tabIds.indexOf(tabId), position), activeTabId: tabId }))
    return { ...reordered, focusedPaneId: paneId }
  }
  return withNormalizedRoot(attach(detach(layout, tabId), tabId, paneId, position), paneId)
}

/** Whether dropping `tabId` on an edge of `paneId` would split it (a pane's only tab cannot split it). */
export function canSplitWith(layout: Layout, tabId: string, paneId: string): boolean {
  const target = findPane(layout, paneId)
  const source = paneOf(layout, tabId)
  return !!target && !!source && !(source.id === paneId && target.tabIds.length < 2)
}

const EDGE_DIRECTION: Record<SplitEdge, SplitDirection> = { left: 'row', right: 'row', top: 'column', bottom: 'column' }

/**
 * Moves `tabId` into a new pane on one edge of `paneId`, which gives up half of its area.
 *
 * @param layout - Current layout.
 * @param tabId - Tab being dragged.
 * @param paneId - Pane being split.
 * @param edge - Edge of that pane where the new pane appears.
 */
export function splitTabTo(layout: Layout, tabId: string, paneId: string, edge: SplitEdge): Layout {
  if (!canSplitWith(layout, tabId, paneId)) return layout
  const newPane = createPane([tabId])
  const isNewPaneFirst = edge === 'left' || edge === 'top'
  const split = (target: PaneNode): SplitNode => ({
    kind: 'split', id: createId(), direction: EDGE_DIRECTION[edge],
    children: isNewPaneFirst ? [newPane, target] : [target, newPane], sizes: [0.5, 0.5],
  })
  // Detach first: the target pane may be the source, and must not lose the tab after splitting.
  const detached = detach(layout, tabId)
  const root = mapTree(detached.root, (node) => (node.kind === 'pane' && node.id === paneId ? split(node) : node))
  return withNormalizedRoot({ root, focusedPaneId: newPane.id })
}

/**
 * Activates another tab of the focused pane.
 *
 * @param layout - Current layout.
 * @param select - Picks the tab id to activate from the pane's ids and the current position.
 */
export function selectInFocusedPane(layout: Layout, select: (tabIds: readonly string[], current: number) => string | undefined): Layout {
  const pane = findPane(layout, layout.focusedPaneId)
  if (!pane) return layout
  const tabId = select(pane.tabIds, pane.activeTabId ? pane.tabIds.indexOf(pane.activeTabId) : -1)
  return tabId ? activateTab(layout, tabId) : layout
}

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

/**
 * Replaces the sizes of a split's children.
 *
 * @param layout - Current layout.
 * @param splitId - Split to resize.
 * @param sizes - New shares, one per child, summing to 1.
 */
export function resizeSplit(layout: Layout, splitId: string, sizes: readonly number[]): Layout {
  const root = mapTree(layout.root, (node) =>
    node.kind === 'split' && node.id === splitId && node.sizes.length === sizes.length ? { ...node, sizes: [...sizes] } : node)
  return { ...layout, root }
}

/**
 * Moves the boundary between children `boundary` and `boundary + 1` of a split, keeping both above a minimum.
 *
 * @param sizes - Current shares of the split's children.
 * @param boundary - Index of the child before the boundary.
 * @param delta - Shift of the boundary, as a share of the split (positive grows the child before it).
 * @param minSize - Smallest share either child may end up with.
 * @returns The new shares; the other children are unchanged.
 */
export function moveBoundary(sizes: readonly number[], boundary: number, delta: number, minSize: number): number[] {
  const pairTotal = sizes[boundary] + sizes[boundary + 1]
  // When the pair is already too small for two minimums, it splits evenly rather than overflowing.
  const lowest = Math.min(minSize, pairTotal / 2)
  const before = Math.min(Math.max(sizes[boundary] + delta, lowest), pairTotal - lowest)
  return sizes.map((size, i) => (i === boundary ? before : i === boundary + 1 ? pairTotal - before : size))
}

/**
 * Gives every child of a split the same share.
 *
 * @param layout - Current layout.
 * @param splitId - Split to even out.
 */
export function equalizeSplit(layout: Layout, splitId: string): Layout {
  const root = mapTree(layout.root, (node) =>
    node.kind === 'split' && node.id === splitId ? { ...node, sizes: node.children.map(() => 1 / node.children.length) } : node)
  return { ...layout, root }
}
