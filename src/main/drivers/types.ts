import type {
  ConnectionConfig, QueryResult, RowChange, RowsRequest, SchemaGraph, TableDetail, TableRef
} from '@shared/types'

/**
 * A driver adapts one database engine. To add an engine (MySQL, DuckDB, ...),
 * implement this interface and register it in drivers/index.ts.
 */
export interface Driver {
  connect(): Promise<void>
  disconnect(): Promise<void>
  listSchemas(): Promise<string[]>
  listTables(schema: string): Promise<TableRef[]>
  describeTable(schema: string, table: string): Promise<TableDetail>
  graph(schema: string): Promise<SchemaGraph>
  rows(req: RowsRequest): Promise<QueryResult>
  query(sql: string): Promise<QueryResult>
  update(change: RowChange): Promise<void>
  insert(schema: string, table: string, values: Record<string, unknown>): Promise<void>
  remove(schema: string, table: string, key: Record<string, unknown>): Promise<void>
}

export type DriverFactory = (config: ConnectionConfig) => Driver

export const quoteIdent = (s: string): string => `"${s.replace(/"/g, '""')}"`
