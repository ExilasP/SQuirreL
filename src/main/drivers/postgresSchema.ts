import type pg from 'pg'
import type { ColumnInfo, TableDetail, TriggerInfo } from '@shared/types'
import { quoteIdent as q } from './types'

/** `pg_trigger.tgtype` bit flags. */
const TG_ROW = 1, TG_BEFORE = 2, TG_INSERT = 4, TG_DELETE = 8, TG_UPDATE = 16, TG_TRUNCATE = 32, TG_INSTEAD = 64

const decodeTiming = (type: number): TriggerInfo['timing'] =>
  type & TG_INSTEAD ? 'INSTEAD OF' : type & TG_BEFORE ? 'BEFORE' : 'AFTER'

const decodeEvents = (type: number): TriggerInfo['events'] => {
  const flags: [number, TriggerInfo['events'][number]][] = [[TG_INSERT, 'INSERT'], [TG_UPDATE, 'UPDATE'], [TG_DELETE, 'DELETE'], [TG_TRUNCATE, 'TRUNCATE']]
  return flags.filter(([flag]) => type & flag).map(([, name]) => name)
}

/** Lists the user-defined triggers of a table (internal FK triggers are skipped). */
export async function fetchTriggers(pool: pg.Pool, schema: string, table: string): Promise<TriggerInfo[]> {
  const r = await pool.query(
    `SELECT t.tgname AS name, t.tgtype::int AS type, t.tgenabled <> 'D' AS enabled, pg_get_triggerdef(t.oid, true) AS definition
     FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = $2 AND NOT t.tgisinternal ORDER BY t.tgname`, [schema, table])
  return r.rows.map((t): TriggerInfo => ({
    name: t.name, definition: `${t.definition};`, isEnabled: t.enabled,
    timing: decodeTiming(t.type), events: decodeEvents(t.type), level: t.type & TG_ROW ? 'row' : 'statement'
  }))
}

const columnDefinition = (c: ColumnInfo): string =>
  `  ${q(c.name)} ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.defaultValue !== null ? ` DEFAULT ${c.defaultValue}` : ''}`

/**
 * Rebuilds a creation script from the catalog: PostgreSQL has no `SHOW CREATE`,
 * so columns come from `detail` and constraints, indexes and triggers are asked to the server.
 */
export async function buildDdl(pool: pg.Pool, detail: TableDetail): Promise<string> {
  const name = `${q(detail.schema)}.${q(detail.name)}`
  const rel = await pool.query(
    `SELECT c.oid, c.relkind, pg_get_viewdef(c.oid, true) AS view_def FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = $2`, [detail.schema, detail.name])
  const { oid, relkind, view_def: viewDef } = rel.rows[0]
  if (relkind === 'v' || relkind === 'm')
    return `CREATE ${relkind === 'm' ? 'MATERIALIZED ' : ''}VIEW ${name} AS\n${viewDef.trim()}`

  const constraints = await pool.query(
    `SELECT conname, pg_get_constraintdef(oid, true) AS def FROM pg_constraint WHERE conrelid = $1
     ORDER BY array_position(ARRAY['p','u','c','f'], contype::text), conname`, [oid])
  const indexes = await pool.query(
    `SELECT pg_get_indexdef(i.indexrelid) AS def FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
     WHERE i.indrelid = $1 AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conindid = i.indexrelid) ORDER BY ic.relname`, [oid])
  const triggers = await fetchTriggers(pool, detail.schema, detail.name)

  const body = [...detail.columns.map(columnDefinition), ...constraints.rows.map((c) => `  CONSTRAINT ${q(c.conname)} ${c.def}`)].join(',\n')
  return [`CREATE TABLE ${name} (\n${body}\n);`, ...indexes.rows.map((i) => `${i.def};`), ...triggers.map((t) => t.definition)].join('\n\n')
}
