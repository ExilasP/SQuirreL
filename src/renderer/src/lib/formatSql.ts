import { format } from 'sql-formatter'
import type { DriverId } from '@shared/types'

const DIALECTS: Record<DriverId, 'postgresql' | 'sqlite'> = { postgres: 'postgresql', sqlite: 'sqlite' }

/**
 * Pretty-prints SQL with one clause per line and indented column lists.
 *
 * @param sql - One or more statements.
 * @param driver - Engine whose dialect drives the parsing.
 * @returns The formatted SQL, or the input untouched if the formatter cannot parse it.
 */
export function formatSql(sql: string, driver: DriverId): string {
  try {
    return format(sql, { language: DIALECTS[driver], keywordCase: 'upper', tabWidth: 2, linesBetweenQueries: 1 })
  } catch {
    return sql
  }
}
