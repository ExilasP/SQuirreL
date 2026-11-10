import { useEffect, useMemo, useState } from 'react'
import { cycleIndex, matchesQuery } from './search'

/** State and actions returned by {@link useColumnSearch}. */
export interface ColumnSearch {
  query: string
  setQuery(query: string): void
  /** Columns whose name matches the query; empty while the query is blank. */
  matches: Set<string>
  /** Match to scroll to, or `null` when nothing matches. */
  current: string | null
  /** 1-based position of `current` among the matches, for a `2 / 5` counter. */
  position: number
  /** Jumps to the next (`1`) or previous (`-1`) match, wrapping around. */
  step(delta: number): void
}

/**
 * Finds columns of a result grid by name, as a browser's Ctrl+F does for text.
 *
 * @param columns - Column names, in display order.
 */
export function useColumnSearch(columns: string[]): ColumnSearch {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const matchList = useMemo(() => (query.trim() ? columns.filter((c) => matchesQuery(c, query)) : []), [columns, query])
  useEffect(() => setIndex(0), [query])
  const safeIndex = Math.min(index, Math.max(matchList.length - 1, 0))
  return {
    query,
    setQuery,
    matches: useMemo(() => new Set(matchList), [matchList]),
    current: matchList[safeIndex] ?? null,
    position: matchList.length ? safeIndex + 1 : 0,
    step: (delta) => setIndex(cycleIndex(safeIndex, delta, matchList.length))
  }
}
