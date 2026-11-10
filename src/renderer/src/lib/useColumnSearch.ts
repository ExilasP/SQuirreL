import { useMemo } from 'react'
import { matchesQuery } from './search'
import { useCyclingSearch, type CyclingSearch } from './useCyclingSearch'

/** {@link CyclingSearch} over column names, with the hits also as a set for quick lookups. */
export interface ColumnSearch extends Omit<CyclingSearch<string>, 'matches'> {
  /** Columns whose name matches the query; empty while the query is blank. */
  matches: Set<string>
}

/**
 * Finds columns of a result grid by name, as a browser's Ctrl+F does for text.
 *
 * @param columns - Column names, in display order.
 */
export function useColumnSearch(columns: string[]): ColumnSearch {
  const search = useCyclingSearch(columns, matchesQuery)
  const matches = useMemo(() => new Set(search.matches), [search.matches])
  return { ...search, matches }
}
