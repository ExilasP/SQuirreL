/** Side of the hovered item where the dragged one will be dropped. */
export type DropSide = 'before' | 'after'

/**
 * Computes the final index of an item dragged onto another one.
 *
 * @param fromIndex - Current index of the dragged item.
 * @param targetIndex - Index of the item it is dropped on.
 * @param side - Whether it lands before or after the target.
 * @returns The index the item should have once moved.
 */
export function dropIndex(fromIndex: number, targetIndex: number, side: DropSide): number {
  const insertAt = side === 'after' ? targetIndex + 1 : targetIndex
  // Removing the item first shifts every later index down by one.
  return fromIndex < insertAt ? insertAt - 1 : insertAt
}

/**
 * Returns a copy of `items` with the element at `fromIndex` moved to `toIndex`.
 *
 * @param items - Source list, left untouched.
 * @param fromIndex - Index of the element to move.
 * @param toIndex - Index the element ends up at.
 */
export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items]
  const [moved] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, moved)
  return result
}
