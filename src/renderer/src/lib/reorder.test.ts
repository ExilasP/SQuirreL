import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem } from './reorder'

describe('dropIndex', () => {
  it('accounts for the removed item when moving forward', () => {
    expect(dropIndex(0, 2, 'after')).toBe(2)
    expect(dropIndex(0, 2, 'before')).toBe(1)
  })

  it('keeps the target index when moving backward', () => {
    expect(dropIndex(3, 0, 'before')).toBe(0)
    expect(dropIndex(3, 0, 'after')).toBe(1)
  })
})

describe('moveItem', () => {
  it('moves without mutating the source', () => {
    const items = ['a', 'b', 'c', 'd']
    expect(moveItem(items, 0, dropIndex(0, 2, 'after'))).toEqual(['b', 'c', 'a', 'd'])
    expect(items).toEqual(['a', 'b', 'c', 'd'])
  })
})
