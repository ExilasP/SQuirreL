import { useEffect, useMemo, useState } from 'react'
import type { SQLNamespace } from '@codemirror/lang-sql'
import type { TableRef } from '@shared/types'
import { useStore } from '@/lib/store'

/** Column names per table name, for one schema. */
type ColumnsByTable = Record<string, string[]>

/**
 * Builds the namespace handed to the CodeMirror SQL extension so it can complete table and
 * column names (including through aliases such as `ss.` in `from sub_sections ss`).
 *
 * Tables of the first schema are exposed unqualified (`users`), every schema is also reachable
 * qualified (`public.users`).
 *
 * @param schemas - Schema names of the connection, in display order.
 * @param tablesBySchema - Tables already loaded for each schema.
 * @param columnsBySchema - Columns already loaded for each schema (may lag behind the tables).
 * @returns The completion namespace, and the schema used for unqualified names.
 */
export function buildSqlNamespace(
  schemas: string[],
  tablesBySchema: Record<string, TableRef[]>,
  columnsBySchema: Record<string, ColumnsByTable>
): { namespace: SQLNamespace; defaultSchema: string | undefined } {
  const namespace: Record<string, SQLNamespace> = {}
  for (const schema of schemas) {
    const tables: Record<string, SQLNamespace> = {}
    for (const table of tablesBySchema[schema] ?? []) {
      tables[table.name] = { self: { label: table.name, type: table.kind === 'view' ? 'view' : 'table' }, children: columnsBySchema[schema]?.[table.name] ?? [] }
    }
    namespace[schema] = tables
  }
  return { namespace, defaultSchema: schemas[0] }
}

/**
 * Provides the SQL completion namespace of a connection. Tables and columns of every schema are
 * loaded the first time they are needed (the sidebar only loads a schema when it is expanded).
 *
 * @param connId - Connection key of the query tab.
 */
export function useSqlNamespace(connId: string): ReturnType<typeof buildSqlNamespace> {
  const node = useStore((s) => s.opened[connId])
  const loadTables = useStore((s) => s.loadTables)
  const [columnsBySchema, setColumnsBySchema] = useState<Record<string, ColumnsByTable>>({})

  useEffect(() => {
    if (!node) return
    for (const schema of node.schemas) {
      if (!node.tables[schema]) loadTables(connId, schema).catch(() => undefined)
    }
  }, [connId, node, loadTables])

  useEffect(() => {
    let isCancelled = false
    setColumnsBySchema({})
    for (const schema of node?.schemas ?? []) {
      window.api.db.graph(connId, schema)
        .then(({ tables }) => {
          if (isCancelled) return
          const columns: ColumnsByTable = Object.fromEntries(tables.map((t) => [t.name, t.columns.map((c) => c.name)]))
          setColumnsBySchema((prev) => ({ ...prev, [schema]: columns }))
        })
        .catch(() => undefined)
    }
    return () => { isCancelled = true }
  }, [connId, node?.schemas])

  return useMemo(
    () => buildSqlNamespace(node?.schemas ?? [], node?.tables ?? {}, columnsBySchema),
    [node?.schemas, node?.tables, columnsBySchema]
  )
}
