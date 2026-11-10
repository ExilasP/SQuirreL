import pg from 'pg'
import type { ConnectionConfig, QueryResult, RowChange, RowsRequest, TableDetail, TableRef } from '@shared/types'
import { type Driver, quoteIdent as q } from './types'
import { buildDdl, fetchTriggers } from './postgresSchema'
import { fetchRoles } from './postgresRoles'
import { fetchTypes } from './postgresTypes'

/** PostgreSQL accepts at most 65535 bind parameters per statement. */
const MAX_PARAMS = 65535
const MAX_ROWS_PER_INSERT = 1000

const FK_ACTIONS: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }

// Return int8 / numeric as strings to avoid precision loss; dates stay as ISO strings.
pg.types.setTypeParser(1082, (v) => v)
pg.types.setTypeParser(1114, (v) => v)
pg.types.setTypeParser(1184, (v) => v)

export function createPostgresDriver(cfg: ConnectionConfig): Driver {
  const pool = new pg.Pool({
    host: cfg.host, port: cfg.port ?? 5432, database: cfg.database, user: cfg.user, password: cfg.password,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined, max: 4,
    // Without a timeout an unreachable host hangs the connection test forever.
    connectionTimeoutMillis: 8000
  })
  // An idle client dropped by the server emits 'error'; unhandled, it would crash the main process.
  pool.on('error', () => {})

  const run = async (sql: string, params: unknown[] = []): Promise<QueryResult> => {
    const t0 = performance.now()
    const r = await pool.query({ text: sql, values: params })
    const res = Array.isArray(r) ? r[r.length - 1] : r
    const columns = res.fields?.map((f: pg.FieldDef) => f.name) ?? []
    return { columns, rows: columns.length ? res.rows : [], rowCount: res.rows.length, affected: columns.length ? undefined : (res.rowCount ?? 0), durationMs: performance.now() - t0 }
  }

  const tableDetail = async (schema: string, table: string, knownKind?: 'table' | 'view'): Promise<TableDetail> => {
    const kind = knownKind ?? ((await pool.query(
      `SELECT c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = $2`, [schema, table]
    )).rows[0]?.relkind.match(/[vm]/) ? 'view' : 'table')
    const cols = await pool.query(
      `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, NOT a.attnotnull AS nullable,
              pg_get_expr(d.adbin, d.adrelid) AS dflt,
              COALESCE(i.indisprimary, false) AS pk, col_description(a.attrelid, a.attnum) AS comment,
              -- A domain over an enum accepts the same labels, hence the lookup through typbasetype.
              ARRAY(SELECT e.enumlabel::text FROM pg_enum e JOIN pg_type t ON t.oid = a.atttypid
                    WHERE e.enumtypid = CASE t.typtype WHEN 'd' THEN t.typbasetype ELSE t.oid END
                    ORDER BY e.enumsortorder) AS enum_values
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       LEFT JOIN pg_index i ON i.indrelid = a.attrelid AND i.indisprimary AND a.attnum = ANY(i.indkey)
       WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [schema, table])
    const fks = await pool.query(
      `SELECT con.conname AS name,
              ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = con.conrelid AND attnum = ANY(con.conkey) ORDER BY array_position(con.conkey, attnum)) AS cols,
              con.confupdtype AS on_update, con.confdeltype AS on_delete,
              rn.nspname AS ref_schema, rc.relname AS ref_table,
              ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = con.confrelid AND attnum = ANY(con.confkey) ORDER BY array_position(con.confkey, attnum)) AS ref_cols
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_class rc ON rc.oid = con.confrelid JOIN pg_namespace rn ON rn.oid = rc.relnamespace
       WHERE con.contype = 'f' AND n.nspname = $1 AND c.relname = $2`, [schema, table])
    const idx = await pool.query(
      `SELECT ic.relname AS name, i.indisunique AS "unique", i.indisprimary AS pk, am.amname AS method,
              pg_get_expr(i.indpred, i.indrelid) AS predicate, pg_get_indexdef(i.indexrelid) AS def,
              ARRAY(SELECT attname::text FROM pg_attribute WHERE attrelid = i.indrelid AND attnum = ANY(i.indkey) ORDER BY array_position(i.indkey::int2[], attnum)) AS cols
       FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_am am ON am.oid = ic.relam
       JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relname = $2`, [schema, table])
    return {
      schema, name: table, kind,
      columns: cols.rows.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable, defaultValue: c.dflt, primaryKey: c.pk, comment: c.comment, enumValues: c.enum_values.length ? c.enum_values : null })),
      foreignKeys: fks.rows.map((f) => ({ name: f.name, columns: f.cols, refSchema: f.ref_schema, refTable: f.ref_table, refColumns: f.ref_cols, onUpdate: FK_ACTIONS[f.on_update], onDelete: FK_ACTIONS[f.on_delete] })),
      indexes: idx.rows.map((i) => ({ name: i.name, unique: i.unique, primary: i.pk, method: i.method, predicate: i.predicate, definition: i.def, columns: i.cols }))
    }
  }

  const where = (key: Record<string, unknown>, offset = 0) => {
    const cols = Object.keys(key); const params: unknown[] = []
    const sql = cols.map((c) => {
      if (key[c] === null) return `${q(c)} IS NULL`
      params.push(key[c]); return `${q(c)} = $${offset + params.length}`
    }).join(' AND ')
    return { sql, params }
  }
  const ref = (s: string, t: string) => `${q(s)}.${q(t)}`

  return {
    async connect() { const c = await pool.connect(); c.release() },
    async disconnect() { await pool.end() },
    async listSchemas() {
      const r = await pool.query(`SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' ORDER BY (nspname = 'public') DESC, nspname`)
      return r.rows.map((x) => x.nspname)
    },
    async listDatabases() {
      const r = await pool.query(`SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname`)
      return r.rows.map((x) => x.datname)
    },
    listRoles: () => fetchRoles(pool),
    async listTables(schema) {
      const r = await pool.query(
        `SELECT c.relname AS name, c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m') ORDER BY c.relname`, [schema])
      return r.rows.map((x): TableRef => ({ schema, name: x.name, kind: x.kind === 'v' || x.kind === 'm' ? 'view' : 'table' }))
    },
    listTypes: (schema) => fetchTypes(pool, schema),
    describeTable: (s, t) => tableDetail(s, t),
    async graph(schema) {
      const tables = await this.listTables(schema)
      return { tables: await Promise.all(tables.map((t) => tableDetail(schema, t.name, t.kind))) }
    },
    listTriggers: (s, t) => fetchTriggers(pool, s, t),
    async getDdl(s, t) { return buildDdl(pool, await tableDetail(s, t)) },
    async rows(req: RowsRequest) {
      const w = req.where?.trim() ? ` WHERE ${req.where}` : ''
      const order = req.orderBy ? ` ORDER BY ${q(req.orderBy.column)} ${req.orderBy.dir === 'desc' ? 'DESC' : 'ASC'}` : ''
      const t = ref(req.schema, req.table)
      const res = await run(`SELECT * FROM ${t}${w}${order} LIMIT $1 OFFSET $2`, [req.limit, req.offset])
      res.total = Number((await pool.query(`SELECT COUNT(*) AS n FROM ${t}${w}`)).rows[0].n)
      return res
    },
    query: (sql) => run(sql),
    async update({ schema, table, key, values }: RowChange) {
      const cols = Object.keys(values); const w = where(key, cols.length)
      // ctid + LIMIT 1: tables without a primary key may hold duplicate rows; touch exactly one
      await pool.query(`UPDATE ${ref(schema, table)} SET ${cols.map((c, i) => `${q(c)} = $${i + 1}`).join(', ')} WHERE ctid = (SELECT ctid FROM ${ref(schema, table)} WHERE ${w.sql} LIMIT 1)`, [...cols.map((c) => values[c]), ...w.params])
    },
    async insert(schema, table, values) {
      const cols = Object.keys(values)
      if (!cols.length) await pool.query(`INSERT INTO ${ref(schema, table)} DEFAULT VALUES`)
      else await pool.query(`INSERT INTO ${ref(schema, table)} (${cols.map(q).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, cols.map((c) => values[c]))
    },
    async remove(schema, table, key) {
      const w = where(key)
      await pool.query(`DELETE FROM ${ref(schema, table)} WHERE ctid = (SELECT ctid FROM ${ref(schema, table)} WHERE ${w.sql} LIMIT 1)`, w.params)
    },
    insertRows: (schema, table, columns, rows, options) => insertRowsInTransaction(pool, ref(schema, table), columns, rows, options.truncate)
  }
}

/** Builds `INSERT ... VALUES ($1, $2), ($3, $4)` for `rowCount` rows of `columns`. */
function buildMultiRowInsert(target: string, columns: string[], rowCount: number): string {
  const tuples = Array.from({ length: rowCount }, (_, r) =>
    `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(', ')})`)
  return `INSERT INTO ${target} (${columns.map(q).join(', ')}) VALUES ${tuples.join(', ')}`
}

async function insertRowsInTransaction(pool: pg.Pool, target: string, columns: string[], rows: (string | null)[][], truncate: boolean): Promise<number> {
  if (!columns.length) throw new Error('No column selected for the import')
  const batchSize = Math.max(1, Math.min(MAX_ROWS_PER_INSERT, Math.floor(MAX_PARAMS / columns.length)))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (truncate) await client.query(`TRUNCATE ${target}`)
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize)
      await client.query(buildMultiRowInsert(target, columns, batch.length), batch.flat())
    }
    await client.query('COMMIT')
    return rows.length
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
