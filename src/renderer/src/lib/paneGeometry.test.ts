import { describe, expect, it } from 'vitest'
import { computeGeometry } from './paneGeometry'
import type { LayoutNode, PaneNode } from './panes'

const pane = (id: string): PaneNode => ({ kind: 'pane', id, tabIds: [id], activeTabId: id })

describe('computeGeometry', () => {
  it('gives a lone pane the whole area', () => {
    expect(computeGeometry(pane('a'))).toEqual({ panes: [{ pane: pane('a'), rect: { x: 0, y: 0, width: 1, height: 1 } }], dividers: [] })
  })

  it('places nested panes and dividers', () => {
    // row[a 0.25, column[b 0.5, c 0.5] 0.75]
    const root: LayoutNode = {
      kind: 'split', id: 'row', direction: 'row', sizes: [0.25, 0.75],
      children: [pane('a'), { kind: 'split', id: 'col', direction: 'column', sizes: [0.5, 0.5], children: [pane('b'), pane('c')] }],
    }
    const { panes, dividers } = computeGeometry(root)
    expect(panes.map((p) => [p.pane.id, p.rect])).toEqual([
      ['a', { x: 0, y: 0, width: 0.25, height: 1 }],
      ['b', { x: 0.25, y: 0, width: 0.75, height: 0.5 }],
      ['c', { x: 0.25, y: 0.5, width: 0.75, height: 0.5 }],
    ])
    expect(dividers.map((d) => [d.splitId, d.boundary, d.offset])).toEqual([['row', 0, 0.25], ['col', 0, 0.5]])
    expect(dividers[1].splitRect).toEqual({ x: 0.25, y: 0, width: 0.75, height: 1 })
  })
})
