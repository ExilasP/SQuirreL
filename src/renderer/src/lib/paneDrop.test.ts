import { describe, expect, it } from 'vitest'
import { dropTargetAt, type PaneDropContext } from './paneDrop'

const context = (overrides: Partial<PaneDropContext>): PaneDropContext => ({
  x: 0.5, y: 0.5, widthPx: 1000, heightPx: 800, minWidthPx: 300, minHeightPx: 200, canSplit: true, ...overrides,
})

describe('dropTargetAt', () => {
  it('joins the pane in the middle', () => {
    expect(dropTargetAt(context({}))).toEqual({ kind: 'center' })
  })

  it('splits on the nearest edge inside the edge band', () => {
    expect(dropTargetAt(context({ x: 0.1 }))).toEqual({ kind: 'edge', edge: 'left' })
    expect(dropTargetAt(context({ x: 0.15, y: 0.95 }))).toEqual({ kind: 'edge', edge: 'bottom' })
  })

  it('ignores edges whose split would make a pane too small', () => {
    expect(dropTargetAt(context({ x: 0.1, widthPx: 500 }))).toEqual({ kind: 'center' })
    // Corner: the left edge is too narrow to split, the top edge still works.
    expect(dropTargetAt(context({ x: 0.05, y: 0.1, widthPx: 500 }))).toEqual({ kind: 'edge', edge: 'top' })
  })

  it('never splits when the tab may not split this pane', () => {
    expect(dropTargetAt(context({ x: 0.05, canSplit: false }))).toEqual({ kind: 'center' })
  })
})
