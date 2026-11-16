import { describe, expect, it } from 'vitest'
import {
  activeTabId, canSplitWith, closeTabsIn, createEmptyLayout, equalizeSplit, findPane, listPanes, moveBoundary, moveTabTo,
  openTabIn, paneOf, resizeSplit, selectInFocusedPane, splitTabTo, type Layout, type LayoutNode, type SplitEdge,
} from './panes'

/** Layout with one pane holding `tabIds`, the last one active. */
function layoutWith(...tabIds: string[]): Layout {
  return tabIds.reduce(openTabIn, createEmptyLayout())
}

const paneIdOf = (layout: Layout, tabId: string): string => paneOf(layout, tabId)!.id
const split = (layout: Layout, tabId: string, besideTabId: string, edge: SplitEdge): Layout =>
  splitTabTo(layout, tabId, paneIdOf(layout, besideTabId), edge)

/** Tree shape with tab ids only, so tests do not depend on generated ids. */
function shapeOf(node: LayoutNode): unknown {
  return node.kind === 'pane' ? node.tabIds : { [node.direction]: node.children.map(shapeOf), sizes: node.sizes }
}

describe('opening and activating tabs', () => {
  it('appends new tabs to the focused pane and activates them', () => {
    const layout = layoutWith('a', 'b')
    expect(shapeOf(layout.root)).toEqual(['a', 'b'])
    expect(activeTabId(layout)).toBe('b')
  })

  it('focuses the pane of a tab that is already open instead of duplicating it', () => {
    const layout = openTabIn(split(layoutWith('a', 'b'), 'b', 'a', 'right'), 'a')
    expect(listPanes(layout.root).flatMap((p) => p.tabIds)).toEqual(['a', 'b'])
    expect(layout.focusedPaneId).toBe(paneIdOf(layout, 'a'))
  })

  it('cycles within the focused pane only', () => {
    const layout = split(layoutWith('a', 'b', 'c'), 'c', 'a', 'right')
    const next = selectInFocusedPane(layout, (ids, current) => ids[(current + 1) % ids.length])
    expect(activeTabId(next)).toBe('c')
  })
})

describe('splitTabTo', () => {
  it('splits a pane in the direction of the edge, the new pane on that side', () => {
    expect(shapeOf(split(layoutWith('a', 'b'), 'b', 'a', 'right').root)).toEqual({ row: [['a'], ['b']], sizes: [0.5, 0.5] })
    expect(shapeOf(split(layoutWith('a', 'b'), 'b', 'a', 'top').root)).toEqual({ column: [['b'], ['a']], sizes: [0.5, 0.5] })
  })

  it('nests splits of different directions', () => {
    const layout = split(split(layoutWith('a', 'b', 'c'), 'b', 'a', 'right'), 'c', 'b', 'bottom')
    expect(shapeOf(layout.root)).toEqual({ row: [['a'], { column: [['b'], ['c']], sizes: [0.5, 0.5] }], sizes: [0.5, 0.5] })
  })

  it('flattens a split of the same direction, halving only the split pane', () => {
    const layout = split(split(layoutWith('a', 'b', 'c'), 'b', 'a', 'right'), 'c', 'b', 'right')
    expect(shapeOf(layout.root)).toEqual({ row: [['a'], ['b'], ['c']], sizes: [0.5, 0.25, 0.25] })
  })

  it('focuses the new pane', () => {
    const layout = split(layoutWith('a', 'b'), 'a', 'b', 'left')
    expect(layout.focusedPaneId).toBe(paneIdOf(layout, 'a'))
    expect(activeTabId(layout)).toBe('a')
  })

  it('refuses to split a pane with its only tab', () => {
    const layout = layoutWith('a')
    expect(canSplitWith(layout, 'a', paneIdOf(layout, 'a'))).toBe(false)
    expect(split(layout, 'a', 'a', 'left')).toBe(layout)
  })

  it('removes the source pane when its last tab splits another pane', () => {
    const layout = split(split(layoutWith('a', 'b', 'c'), 'c', 'a', 'right'), 'c', 'a', 'bottom')
    expect(shapeOf(layout.root)).toEqual({ column: [['a', 'b'], ['c']], sizes: [0.5, 0.5] })
  })
})

describe('closeTabsIn', () => {
  it('activates the neighbour of a closed active tab', () => {
    const layout = closeTabsIn(layoutWith('a', 'b', 'c'), ['c'])
    expect(activeTabId(layout)).toBe('b')
  })

  it('gives the space of a closed pane to its siblings in proportion', () => {
    const three = split(split(layoutWith('a', 'b', 'c'), 'b', 'a', 'right'), 'c', 'b', 'right')
    expect(shapeOf(closeTabsIn(three, ['a']).root)).toEqual({ row: [['b'], ['c']], sizes: [0.5, 0.5] })
  })

  it('dissolves a split left with one child and moves the focus to an existing pane', () => {
    const layout = closeTabsIn(split(layoutWith('a', 'b'), 'b', 'a', 'right'), ['b'])
    expect(shapeOf(layout.root)).toEqual(['a'])
    expect(layout.focusedPaneId).toBe(paneIdOf(layout, 'a'))
  })

  it('merges a split into its parent when the split between them disappears', () => {
    // row[a, column[b, row[c, d]]]: closing b leaves row[c, d] directly inside the outer row.
    let layout = split(layoutWith('a', 'b', 'c', 'd'), 'b', 'a', 'right')
    layout = split(layout, 'c', 'b', 'bottom')
    layout = split(layout, 'd', 'c', 'right')
    expect(shapeOf(closeTabsIn(layout, ['b']).root)).toEqual({ row: [['a'], ['c'], ['d']], sizes: [0.5, 0.25, 0.25] })
  })

  it('falls back to an empty pane when every tab is closed', () => {
    const layout = closeTabsIn(split(layoutWith('a', 'b'), 'b', 'a', 'right'), ['a', 'b'])
    expect(shapeOf(layout.root)).toEqual([])
    expect(findPane(layout, layout.focusedPaneId)).toBeDefined()
  })
})

describe('moveTabTo', () => {
  it('reorders within a pane', () => {
    const layout = layoutWith('a', 'b', 'c')
    expect(shapeOf(moveTabTo(layout, 'a', paneIdOf(layout, 'a'), 2).root)).toEqual(['b', 'c', 'a'])
  })

  it('moves to another pane and removes the emptied source', () => {
    const layout = split(layoutWith('a', 'b'), 'b', 'a', 'right')
    const moved = moveTabTo(layout, 'b', paneIdOf(layout, 'a'), 0)
    expect(shapeOf(moved.root)).toEqual(['b', 'a'])
    expect(activeTabId(moved)).toBe('b')
  })
})

/** Compares shares with a tolerance, since they come from floating-point arithmetic. */
function expectSizes(actual: number[], expected: number[]): void {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((size, i) => expect(size).toBeCloseTo(expected[i]))
}

describe('sizes', () => {
  it('moves a boundary without touching other children', () => {
    expectSizes(moveBoundary([0.25, 0.25, 0.5], 0, 0.1, 0.1), [0.35, 0.15, 0.5])
  })

  it('stops a boundary at the minimum size', () => {
    expectSizes(moveBoundary([0.5, 0.5], 0, 0.6, 0.2), [0.8, 0.2])
    expectSizes(moveBoundary([0.5, 0.5], 0, -0.6, 0.2), [0.2, 0.8])
  })

  it('splits evenly a pair too small for two minimums', () => {
    expect(moveBoundary([0.1, 0.1, 0.8], 0, 0.05, 0.2)).toEqual([0.1, 0.1, 0.8])
  })

  it('resizes and equalizes a split by id', () => {
    const layout = split(layoutWith('a', 'b'), 'b', 'a', 'right')
    const splitId = layout.root.id
    expect(shapeOf(resizeSplit(layout, splitId, [0.7, 0.3]).root)).toEqual({ row: [['a'], ['b']], sizes: [0.7, 0.3] })
    expect(shapeOf(equalizeSplit(resizeSplit(layout, splitId, [0.7, 0.3]), splitId).root)).toEqual({ row: [['a'], ['b']], sizes: [0.5, 0.5] })
  })
})
