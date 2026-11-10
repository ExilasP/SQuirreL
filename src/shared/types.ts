export type DriverId = 'sqlite' | 'postgres'

const DATABASE_SEPARATOR = '::'

/**
 * Key of one database opened through a connection. PostgreSQL needs a separate
 * session per database, so each one is addressed as `<connectionId>::<database>`.
 */
export const databaseKey = (connId: string, database: string): string => `${connId}${DATABASE_SEPARATOR}${database}`

/** Splits a key built by {@link databaseKey}; a plain connection id has no `database`. */
export function parseConnectionKey(key: string): { connId: string; database?: string } {
  const at = key.indexOf(DATABASE_SEPARATOR)
  return at < 0 ? { connId: key } : { connId: key.slice(0, at), database: key.slice(at + DATABASE_SEPARATOR.length) }
}

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
  /** User-provided column comment, when the engine supports them (PostgreSQL). */
  comment: string | null
  /**
   * Allowed values when the column type is an enum (or a domain over one), in
   * sort order; `null` for any other type. Lets editors offer a picker.
   */
  enumValues: string[] | null
}

export interface ForeignKey {
  name: string
  columns: string[]
  refSchema: string
  refTable: string
  refColumns: string[]
  /** Referential action on update, e.g. `CASCADE`, `NO ACTION`. */
  onUpdate: string
  /** Referential action on delete, e.g. `CASCADE`, `SET NULL`. */
  onDelete: string
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
  /** True for the index backing the primary key. */
  primary: boolean
  /** Access method, e.g. `btree`, `gin`. */
  method: string
  /** `WHERE` clause of a partial index, null for a full index. */
  predicate: string | null
  /** Full `CREATE INDEX` statement, null when the engine keeps none (implicit indexes). */
  definition: string | null
}

export interface TriggerInfo {
  name: string
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
  events: ('INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE')[]
  level: 'row' | 'statement'
  isEnabled: boolean
  /** Full `CREATE TRIGGER` statement. */
  definition: string
}

/** A PostgreSQL role: a login role is a "user", a role without login is a "group". */
export interface RoleInfo {
  name: string
  canLogin: boolean
  isSuperuser: boolean
  canCreateDb: boolean
  canCreateRole: boolean
  isReplication: boolean
  bypassRls: boolean
  /** Maximum concurrent connections, `null` when unlimited. */
  connectionLimit: number | null
  /** ISO timestamp after which the password expires, `null` when it never does. */
  validUntil: string | null
  /** Names of the roles this one is a member of. */
  memberOf: string[]
}

/** Kind of a user-defined PostgreSQL type, as created by `CREATE TYPE` / `CREATE DOMAIN`. */
export type TypeKind = 'enum' | 'composite' | 'domain' | 'range'

/** A user-defined type of a schema (PostgreSQL). Fields that do not apply to its `kind` are empty. */
export interface TypeInfo {
  schema: string
  name: string
  kind: TypeKind
  owner: string
  comment: string | null
  /** Labels of an enum, in sort order. */
  labels: string[]
  /** Fields of a composite type, in declaration order. */
  attributes: { name: string; type: string }[]
  /** Underlying type of a domain, or subtype of a range. */
  baseType: string | null
  /** Domain only: whether `NOT NULL` is enforced. */
  isNotNull: boolean
  /** Domain only: default expression. */
  defaultValue: string | null
  /** Domain only: `CHECK (...)` constraint definitions. */
  checks: string[]
  /** Script recreating the type. */
  definition: string
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

/**
 * How a CSV file is laid out. Defaults match pgAdmin's export (comma, double
 * quotes, header row, unquoted empty field = NULL).
 */
export interface CsvFormat {
  /** Single field separator character, e.g. `,`, `;`, `\t`, `|`. */
  delimiter: string
  /** First line holds column names rather than data. */
  hasHeader: boolean
  /**
   * Read an unquoted empty field as NULL (PostgreSQL `COPY ... CSV` semantics);
   * a quoted `""` always stays an empty string.
   */
  emptyAsNull: boolean
  /**
   * Unquoted text standing for NULL, e.g. `NULL` as written by pgAdmin's query
   * tool download; a quoted `"NULL"` stays text. Empty string disables it.
   */
  nullMarker: string
}

/** A CSV cell: `null` when the field is NULL per {@link CsvFormat.emptyAsNull} or {@link CsvFormat.nullMarker}. */
export type CsvCell = string | null

/** First lines of a CSV file, shown before importing it. */
export interface CsvPreview {
  path: string
  /** Delimiter detected from the first line, used unless the caller forced one. */
  delimiter: string
  /** Header names, or `column_1`, `column_2`… when the file has no header. */
  headers: string[]
  /** First data rows. */
  rows: CsvCell[][]
  /** Number of data rows in the whole file. */
  rowCount: number
}

/** Loads a CSV file into an existing table. */
export interface CsvImportRequest {
  path: string
  schema: string
  table: string
  format: CsvFormat
  /** Target column for each CSV column, by position; `null` skips that CSV column. */
  mapping: (string | null)[]
  /** Empty the table first (inside the same transaction). */
  truncate: boolean
}
export interface ImportOutcome { count: number }

/** A SQL script kept in the app's own library, scoped to one connection. */
export interface SavedQuery {
  id: string
  /** Connection the script was written for (SQL depends on its schema). */
  connId: string
  name: string
  sql: string
  /** Epoch milliseconds of the last save. */
  updatedAt: number
}

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
    /** Databases of the server that can be opened; empty for engines with one database per file (SQLite). */
    databases(id: string): Promise<string[]>
    /** Roles of the server; empty for engines without a role system (SQLite). */
    roles(id: string): Promise<RoleInfo[]>
    tables(id: string, schema: string): Promise<TableRef[]>
    /** User-defined types of a schema; empty for engines without them (SQLite). */
    types(id: string, schema: string): Promise<TypeInfo[]>
    describe(id: string, schema: string, table: string): Promise<TableDetail>
    graph(id: string, schema: string): Promise<SchemaGraph>
    triggers(id: string, schema: string, table: string): Promise<TriggerInfo[]>
    ddl(id: string, schema: string, table: string): Promise<string>
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
  import: {
    /** Asks the user for a CSV file; `null` when cancelled. */
    pickCsv(): Promise<string | null>
    /** Parses the start of a CSV file; a missing `format.delimiter` is detected. */
    previewCsv(path: string, format: Omit<CsvFormat, 'delimiter'> & { delimiter?: string }): Promise<CsvPreview>
    /** Inserts every row of the file in one transaction: all rows land, or none. */
    csv(id: string, req: CsvImportRequest): Promise<ImportOutcome>
  }
  queries: {
    list(): Promise<SavedQuery[]>
    /** Inserts or replaces by `id`; returns the full updated library. */
    save(q: SavedQuery): Promise<SavedQuery[]>
    remove(id: string): Promise<SavedQuery[]>
  }
  scripts: {
    openFile(): Promise<{ path: string; content: string } | null>
    saveFile(path: string | null, content: string): Promise<string | null>
  }
}
