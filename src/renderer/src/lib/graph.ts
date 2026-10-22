import type { SchemaGraph } from '@shared/types'

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
