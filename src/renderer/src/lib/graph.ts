import type { SchemaGraph, TableDetail } from '@shared/types'
import { matchesQuery } from './search'

/**
 * Restricts a schema graph to one table and the tables directly linked to it
 * by a foreign key, in either direction.
 *
 * @param graph - Full schema graph.
 * @param tableName - Table to center the graph on.
 * @returns A graph holding the table and its direct neighbours; empty if the table is unknown.
 */
export function filterGraphAround(graph: SchemaGraph, tableName: string): SchemaGraph {
  const center = graph.tables.find((t) => t.name === tableName)
  if (!center) return { tables: [] }
  const related = new Set<string>([tableName])
  center.foreignKeys.forEach((f) => related.add(f.refTable))
  graph.tables.forEach((t) => {
    if (t.foreignKeys.some((f) => f.refTable === tableName)) related.add(t.name)
  })
  return { tables: graph.tables.filter((t) => related.has(t.name)) }
}

/** A foreign-key relationship between two tables, as drawn by the ERD. */
export interface ErdLink {
  id: string
  fromTable: string
  fromColumns: string[]
  toTable: string
  toColumns: string[]
}

/** What the user clicked in the ERD: a column or a relationship. */
export type ErdSelection =
  | { kind: 'column'; table: string; column: string }
  | { kind: 'link'; id: string }

/** Elements of the ERD to draw in highlight. */
export interface ErdHighlight {
  /** Keys built by {@link columnKey}. */
  columns: Set<string>
  linkIds: Set<string>
}

/**
 * Builds the identifier used to track a column across tables.
 *
 * @param table - Table name.
 * @param column - Column name.
 * @returns A key unique within a schema.
 */
export function columnKey(table: string, column: string): string {
  return `${table}.${column}`
}

/**
 * Computes what to highlight for a selection. A clicked column lights up the
 * relationships it takes part in, with the paired columns on the other side;
 * a clicked relationship lights up the columns of both ends.
 *
 * @param links - All relationships of the diagram.
 * @param selection - Current selection.
 * @returns The columns and relationships to highlight.
 */
export function computeHighlight(links: ErdLink[], selection: ErdSelection): ErdHighlight {
  const highlight: ErdHighlight = { columns: new Set(), linkIds: new Set() }
  if (selection.kind === 'link') {
    const link = links.find((l) => l.id === selection.id)
    if (!link) return highlight
    highlight.linkIds.add(link.id)
    link.fromColumns.forEach((c) => highlight.columns.add(columnKey(link.fromTable, c)))
    link.toColumns.forEach((c) => highlight.columns.add(columnKey(link.toTable, c)))
    return highlight
  }
  highlight.columns.add(columnKey(selection.table, selection.column))
  for (const link of links) {
    const fromIndex = link.fromTable === selection.table ? link.fromColumns.indexOf(selection.column) : -1
    const toIndex = link.toTable === selection.table ? link.toColumns.indexOf(selection.column) : -1
    if (fromIndex >= 0) highlight.columns.add(columnKey(link.toTable, link.toColumns[fromIndex]))
    if (toIndex >= 0) highlight.columns.add(columnKey(link.fromTable, link.fromColumns[toIndex]))
    if (fromIndex >= 0 || toIndex >= 0) highlight.linkIds.add(link.id)
  }
  return highlight
}

/** A table, or one of its columns, that the ERD search can find. */
export interface ErdSearchTarget {
  table: string
  /** Set for a column, absent for the table itself. */
  column?: string
}

/**
 * Lists what the ERD search looks through: each table followed by its columns.
 *
 * @param tables - Tables drawn in the diagram, in display order.
 */
export function listErdSearchTargets(tables: TableDetail[]): ErdSearchTarget[] {
  return tables.flatMap((t) => [{ table: t.name }, ...t.columns.map((c) => ({ table: t.name, column: c.name }))])
}

/** Whether a table or column name matches the ERD search query. */
export function matchesErdSearchTarget(target: ErdSearchTarget, query: string): boolean {
  return matchesQuery(target.column ?? target.table, query)
}
