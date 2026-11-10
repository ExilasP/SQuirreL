import { useEffect, useMemo, useState } from 'react'
import { cycleIndex } from './search'

/** State and actions returned by {@link useCyclingSearch}. */
export interface CyclingSearch<T> {
  query: string
  setQuery(query: string): void
  /** Items matching the query, in display order; empty while the query is blank. */
  matches: T[]
  /** Match to reveal, or `null` when nothing matches. */
  current: T | null
  /** 1-based position of `current` among the matches, for a `2 / 5` counter. */
  position: number
  /** Jumps to the next (`1`) or previous (`-1`) match, wrapping around. */
  step(delta: number): void
}

/**
 * Searches a list as a browser's Ctrl+F does: every hit is known and one of
 * them is current, Enter / Shift+Enter moving through them.
 *
 * @param items - Searchable items, in display order; keep the array stable between renders.
 * @param isMatch - Whether an item matches a non-blank query; keep it stable too.
 */
export function useCyclingSearch<T>(items: T[], isMatch: (item: T, query: string) => boolean): CyclingSearch<T> {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const matches = useMemo(() => (query.trim() ? items.filter((item) => isMatch(item, query)) : []), [items, isMatch, query])
  useEffect(() => setIndex(0), [query])
  const safeIndex = Math.min(index, Math.max(matches.length - 1, 0))
  return {
    query,
    setQuery,
    matches,
    current: matches[safeIndex] ?? null,
    position: matches.length ? safeIndex + 1 : 0,
    step: (delta) => setIndex(cycleIndex(safeIndex, delta, matches.length))
  }
}
