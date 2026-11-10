import type {
  ConnectionConfig, QueryResult, RoleInfo, RowChange, RowsRequest, SchemaGraph, TableDetail, TableRef, TriggerInfo, TypeInfo
} from '@shared/types'

/**
 * A driver adapts one database engine. To add an engine (MySQL, DuckDB, ...),
 * implement this interface and register it in drivers/index.ts.
 */
export interface Driver {
  connect(): Promise<void>
  disconnect(): Promise<void>
  listSchemas(): Promise<string[]>
  /** Databases the server accepts connections to; empty for single-database engines. */
  listDatabases(): Promise<string[]>
  /** Server roles (users and groups); engines without roles return an empty list. */
  listRoles(): Promise<RoleInfo[]>
  listTables(schema: string): Promise<TableRef[]>
  /** User-defined types (enums, composites, domains, ranges); engines without them return an empty list. */
  listTypes(schema: string): Promise<TypeInfo[]>
  describeTable(schema: string, table: string): Promise<TableDetail>
  graph(schema: string): Promise<SchemaGraph>
  listTriggers(schema: string, table: string): Promise<TriggerInfo[]>
  /** Script recreating the table (or view) with its indexes and triggers. */
  getDdl(schema: string, table: string): Promise<string>
  rows(req: RowsRequest): Promise<QueryResult>
  query(sql: string): Promise<QueryResult>
  update(change: RowChange): Promise<void>
  insert(schema: string, table: string, values: Record<string, unknown>): Promise<void>
  remove(schema: string, table: string, key: Record<string, unknown>): Promise<void>
  /**
   * Bulk-inserts rows in a single transaction, so a failing row rolls back the whole load.
   *
   * @param columns - Target columns, in the order of each row's values.
   * @param rows - Values as text (cast by the engine to the column types) or `null`.
   * @param options - `truncate` empties the table first, inside the same transaction.
   * @returns The number of inserted rows.
   */
  insertRows(schema: string, table: string, columns: string[], rows: (string | null)[][], options: { truncate: boolean }): Promise<number>
}

export type DriverFactory = (config: ConnectionConfig) => Driver

export const quoteIdent = (s: string): string => `"${s.replace(/"/g, '""')}"`
