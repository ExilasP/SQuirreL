/**
 * Whether `text` contains `query`, ignoring case and surrounding spaces.
 *
 * @param text - Candidate text, e.g. a table or column name.
 * @param query - Text typed by the user; an empty query matches everything.
 */
export function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.trim().toLowerCase())
}

/**
 * Moves through a cyclic list of matches, wrapping at both ends.
 *
 * @param index - Current position.
 * @param delta - Step, `1` for next and `-1` for previous.
 * @param length - Number of matches; `0` always yields `0`.
 */
export function cycleIndex(index: number, delta: number, length: number): number {
  if (length === 0) return 0
  return (((index + delta) % length) + length) % length
}
