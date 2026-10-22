import Database from 'better-sqlite3'
import type { ConnectionConfig, QueryResult, RowChange, RowsRequest, TableDetail, TableRef } from '@shared/types'
import { type Driver, quoteIdent as q } from './types'

const normalize = (v: unknown): unknown => (Buffer.isBuffer(v) ? `<blob ${v.length} bytes>` : typeof v === 'bigint' ? v.toString() : v)

export function createSqliteDriver(cfg: ConnectionConfig): Driver {
  let db: Database.Database

  const run = (sql: string, params: unknown[] = []): QueryResult => {
    const t0 = performance.now()
    const stmt = db.prepare(sql)
    if (stmt.reader) {
      const raw = stmt.raw(false).all(...params) as Record<string, unknown>[]
      const rows = raw.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, normalize(v)])))
      return { columns: stmt.columns().map((c) => c.name), rows, rowCount: rows.length, durationMs: performance.now() - t0 }
    }
    const info = stmt.run(...params)
    return { columns: [], rows: [], rowCount: 0, affected: info.changes, durationMs: performance.now() - t0 }
  }

  const describe = (table: string, knownKind?: 'table' | 'view'): TableDetail => {
    const kind = knownKind ?? ((db.prepare(`SELECT type FROM sqlite_master WHERE name = ?`).get(table) as any)?.type === 'view' ? 'view' : 'table')
    const cols = db.prepare(`PRAGMA table_info(${q(table)})`).all() as any[]
    const fks = db.prepare(`PRAGMA foreign_key_list(${q(table)})`).all() as any[]
    const idx = db.prepare(`PRAGMA index_list(${q(table)})`).all() as any[]
    const grouped = new Map<number, any[]>()
    for (const f of fks) grouped.set(f.id, [...(grouped.get(f.id) ?? []), f])
    return {
      schema: 'main', name: table, kind,
      columns: cols.map((c) => ({ name: c.name, type: c.type || 'ANY', nullable: !c.notnull && !c.pk, defaultValue: c.dflt_value, primaryKey: c.pk > 0 })),
      foreignKeys: [...grouped.entries()].map(([id, g]) => ({
        name: `fk_${table}_${id}`, columns: g.map((x) => x.from), refSchema: 'main', refTable: g[0].table, refColumns: g.map((x) => x.to)
      })),
      indexes: idx.map((i) => ({
        name: i.name, unique: !!i.unique,
        columns: (db.prepare(`PRAGMA index_info(${q(i.name)})`).all() as any[]).map((c) => c.name)
      }))
    }
  }

  const where = (key: Record<string, unknown>) => {
    const cols = Object.keys(key)
    return { sql: cols.map((c) => (key[c] === null ? `${q(c)} IS NULL` : `${q(c)} = ?`)).join(' AND '), params: cols.filter((c) => key[c] !== null).map((c) => key[c]) }
  }

  return {
    async connect() { db = new Database(cfg.file!, { fileMustExist: false }); db.pragma('foreign_keys = ON') },
    async disconnect() { db?.close() },
    async listSchemas() { return ['main'] },
    async listTables() {
      return (db.prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as any[])
        .map((r): TableRef => ({ schema: 'main', name: r.name, kind: r.type }))
    },
    async describeTable(_s, table) { return describe(table) },
    async graph() {
      const list = db.prepare(`SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'`).all() as any[]
      return { tables: list.map((t) => describe(t.name, t.type)) }
    },
    async rows(req: RowsRequest) {
      const w = req.where?.trim() ? ` WHERE ${req.where}` : ''
      const order = req.orderBy ? ` ORDER BY ${q(req.orderBy.column)} ${req.orderBy.dir === 'desc' ? 'DESC' : 'ASC'}` : ''
      const res = run(`SELECT * FROM ${q(req.table)}${w}${order} LIMIT ? OFFSET ?`, [req.limit, req.offset])
      res.total = (db.prepare(`SELECT COUNT(*) AS n FROM ${q(req.table)}${w}`).get() as any).n
      return res
    },
    async query(sql) { return run(sql) },
    async update({ table, key, values }: RowChange) {
      const cols = Object.keys(values); const w = where(key)
      db.prepare(`UPDATE ${q(table)} SET ${cols.map((c) => `${q(c)} = ?`).join(', ')} WHERE rowid = (SELECT rowid FROM ${q(table)} WHERE ${w.sql} LIMIT 1)`).run(...cols.map((c) => values[c]), ...w.params)
    },
    async insert(_s, table, values) {
      const cols = Object.keys(values)
      if (!cols.length) db.prepare(`INSERT INTO ${q(table)} DEFAULT VALUES`).run()
      else db.prepare(`INSERT INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map((c) => values[c]))
    },
    async remove(_s, table, key) {
      const w = where(key)
      db.prepare(`DELETE FROM ${q(table)} WHERE rowid = (SELECT rowid FROM ${q(table)} WHERE ${w.sql} LIMIT 1)`).run(...w.params)
    }
  }
}
