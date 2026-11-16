import { moveItem } from './reorder'

/** Index of a pane in the split: `0` is the left one, `1` the right one. */
export type PaneIndex = 0 | 1

/** Edge of the workspace where a dragged tab opens a new pane. */
export type SplitSide = 'left' | 'right'

/** One column of the workspace, with its own tab strip. */
export interface Pane {
  /** Ids of the tabs shown in this pane, in tab strip order. */
  tabIds: string[]
  activeTabId: string | null
}

/**
 * How open tabs are spread over the workspace: one pane, or two side by side.
 *
 * Invariant: one or two panes; when there are two, neither is empty.
 */
export interface Layout {
  panes: Pane[]
  /** Pane receiving new tabs and keyboard shortcuts. */
  focusedPane: PaneIndex
}

/** Layout with a single, empty pane. */
export const EMPTY_LAYOUT: Layout = { panes: [{ tabIds: [], activeTabId: null }], focusedPane: 0 }

/** Pane holding `tabId`, or `-1` when the tab is not open. */
export function paneOf(layout: Layout, tabId: string): PaneIndex | -1 {
  const index = layout.panes.findIndex((p) => p.tabIds.includes(tabId))
  return index === -1 ? -1 : (index as PaneIndex)
}

/** Active tab of the focused pane. */
export function activeTabId(layout: Layout): string | null {
  return layout.panes[layout.focusedPane]?.activeTabId ?? null
}

function withPane(layout: Layout, index: PaneIndex, pane: Pane): Layout {
  return { ...layout, panes: layout.panes.map((p, i) => (i === index ? pane : p)) }
}

/** Drops empty panes so a split never shows a blank column. */
function collapseEmptyPanes(layout: Layout): Layout {
  const panes = layout.panes.filter((p) => p.tabIds.length > 0)
  if (panes.length === layout.panes.length) return layout
  if (panes.length === 0) return EMPTY_LAYOUT
  return { panes: [panes[0]], focusedPane: 0 }
}

/** Removes `tabId` from its pane, activating a neighbour if it was active; may leave the pane empty. */
function detach(layout: Layout, tabId: string): Layout {
  const index = paneOf(layout, tabId)
  if (index === -1) return layout
  const pane = layout.panes[index]
  const position = pane.tabIds.indexOf(tabId)
  const tabIds = pane.tabIds.filter((id) => id !== tabId)
  const activeId = pane.activeTabId === tabId ? (tabIds[Math.min(position, tabIds.length - 1)] ?? null) : pane.activeTabId
  return withPane(layout, index, { tabIds, activeTabId: activeId })
}

/** Inserts `tabId` in pane `index` at `position` (end by default), activating and focusing it. */
function attach(layout: Layout, tabId: string, index: PaneIndex, position?: number): Layout {
  const pane = layout.panes[index]
  const tabIds = [...pane.tabIds]
  tabIds.splice(position ?? tabIds.length, 0, tabId)
  return { ...withPane(layout, index, { tabIds, activeTabId: tabId }), focusedPane: index }
}

/**
 * Shows `tabId`: focuses it if already open, otherwise appends it to the focused pane.
 *
 * @param layout - Current layout.
 * @param tabId - Tab to show.
 */
export function openTabIn(layout: Layout, tabId: string): Layout {
  const index = paneOf(layout, tabId)
  return index === -1 ? attach(layout, tabId, layout.focusedPane) : activateTab(layout, tabId)
}

/** Makes `tabId` the active tab of its pane and focuses that pane. */
export function activateTab(layout: Layout, tabId: string): Layout {
  const index = paneOf(layout, tabId)
  if (index === -1) return layout
  return { ...withPane(layout, index, { ...layout.panes[index], activeTabId: tabId }), focusedPane: index }
}

/** Focuses pane `index`, if it exists. */
export function focusPane(layout: Layout, index: PaneIndex): Layout {
  return index < layout.panes.length ? { ...layout, focusedPane: index } : layout
}

/**
 * Closes the given tabs, merging the split back into one pane if a side becomes empty.
 *
 * @param layout - Current layout.
 * @param tabIds - Tabs to close; unknown ids are ignored.
 */
export function closeTabsIn(layout: Layout, tabIds: readonly string[]): Layout {
  return collapseEmptyPanes(tabIds.reduce(detach, layout))
}

/**
 * Moves `tabId` to `position` in pane `index` (reorder within a pane, or move across panes).
 *
 * @param layout - Current layout.
 * @param tabId - Tab being dragged.
 * @param index - Destination pane.
 * @param position - Final index of the tab in the destination strip.
 */
export function moveTabTo(layout: Layout, tabId: string, index: PaneIndex, position: number): Layout {
  const source = paneOf(layout, tabId)
  if (source === -1 || index >= layout.panes.length) return layout
  if (source === index) {
    const pane = layout.panes[index]
    const tabIds = moveItem(pane.tabIds, pane.tabIds.indexOf(tabId), position)
    return { ...withPane(layout, index, { tabIds, activeTabId: tabId }), focusedPane: index }
  }
  return collapseEmptyPanes(attach(detach(layout, tabId), tabId, index, position))
}

/**
 * Sends `tabId` to the `side` pane, splitting the workspace when it has a single pane.
 *
 * A pane's only tab cannot split it: that would leave the other side empty.
 *
 * @param layout - Current layout.
 * @param tabId - Tab being dragged.
 * @param side - Edge the tab was dropped on.
 */
export function splitTabTo(layout: Layout, tabId: string, side: SplitSide): Layout {
  const source = paneOf(layout, tabId)
  if (source === -1) return layout
  const target: PaneIndex = side === 'left' ? 0 : 1
  if (layout.panes.length === 2) return moveTabTo(layout, tabId, target, layout.panes[target].tabIds.length)
  if (layout.panes[0].tabIds.length < 2) return layout
  const remaining = detach(layout, tabId).panes[0]
  const moved: Pane = { tabIds: [tabId], activeTabId: tabId }
  return { panes: side === 'left' ? [moved, remaining] : [remaining, moved], focusedPane: target }
}

/**
 * Activates another tab of the focused pane.
 *
 * @param layout - Current layout.
 * @param select - Picks the tab id to activate from the pane's ids and the current position.
 */
export function selectInFocusedPane(layout: Layout, select: (tabIds: readonly string[], current: number) => string | undefined): Layout {
  const pane = layout.panes[layout.focusedPane]
  const tabId = select(pane.tabIds, pane.activeTabId ? pane.tabIds.indexOf(pane.activeTabId) : -1)
  return tabId ? activateTab(layout, tabId) : layout
}
