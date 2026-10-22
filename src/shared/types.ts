export type DriverId = 'sqlite' | 'postgres'

export interface ConnectionConfig {
  id: string
  name: string
  driver: DriverId
  color?: string
  /** sqlite: file path */
  file?: string
  /** postgres */
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
}

export interface TableRef {
  schema: string
  name: string
  kind: 'table' | 'view'
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  primaryKey: boolean
}

export interface ForeignKey {
  name: string
  columns: string[]
  refSchema: string
  refTable: string
  refColumns: string[]
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
}

export interface TableDetail extends TableRef {
  columns: ColumnInfo[]
  foreignKeys: ForeignKey[]
  indexes: IndexInfo[]
}

export interface SchemaGraph {
  tables: TableDetail[]
}

export interface RowsRequest {
  schema: string
  table: string
  limit: number
  offset: number
  orderBy?: { column: string; dir: 'asc' | 'desc' }
  /** raw SQL fragment after WHERE, entered by the user */
  where?: string
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  /** total rows matching, when known (table browsing) */
  total?: number
  durationMs: number
  /** for statements without result set */
  affected?: number
}

export interface RowChange {
  schema: string
  table: string
  /** primary key (or full row for tables without pk) identifying the row */
  key: Record<string, unknown>
  values: Record<string, unknown>
}

export type ExportFormat = 'csv' | 'json'
export interface ExportOutcome { path: string; count: number }

export interface Api {
  connections: {
    list(): Promise<ConnectionConfig[]>
    save(c: ConnectionConfig): Promise<ConnectionConfig[]>
    remove(id: string): Promise<ConnectionConfig[]>
    test(c: ConnectionConfig): Promise<{ ok: boolean; error?: string }>
    open(id: string): Promise<void>
    close(id: string): Promise<void>
    pickFile(): Promise<string | null>
  }
  db: {
    schemas(id: string): Promise<string[]>
    tables(id: string, schema: string): Promise<TableRef[]>
    describe(id: string, schema: string, table: string): Promise<TableDetail>
    graph(id: string, schema: string): Promise<SchemaGraph>
    rows(id: string, req: RowsRequest): Promise<QueryResult>
    query(id: string, sql: string): Promise<QueryResult>
    update(id: string, change: RowChange): Promise<void>
    insert(id: string, schema: string, table: string, values: Record<string, unknown>): Promise<void>
    remove(id: string, schema: string, table: string, key: Record<string, unknown>): Promise<void>
  }
  export: {
    table(id: string, req: Omit<RowsRequest, 'limit' | 'offset'>, format: ExportFormat): Promise<ExportOutcome | null>
    result(name: string, format: ExportFormat, columns: string[], rows: Record<string, unknown>[]): Promise<ExportOutcome | null>
  }
  scripts: {
    openFile(): Promise<{ path: string; content: string } | null>
    saveFile(path: string | null, content: string): Promise<string | null>
  }
}
