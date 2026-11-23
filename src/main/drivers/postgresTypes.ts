import type pg from 'pg'
import type { TypeAlteration, TypeInfo, TypeKind, TypeTarget } from '@shared/types'
import { buildAlterTypeStatements } from '@shared/typeAlterations'
import { quoteIdent as q, quoteLiteral } from '@shared/sql'

const KINDS: Record<string, TypeKind> = { e: 'enum', c: 'composite', d: 'domain', r: 'range' }

/** Rebuilds the `CREATE TYPE` / `CREATE DOMAIN` statement; PostgreSQL has no `pg_get_typedef`. */
function buildTypeDefinition(t: Omit<TypeInfo, 'definition'>): string {
  const name = `${q(t.schema)}.${q(t.name)}`
  switch (t.kind) {
    case 'enum':
      return `CREATE TYPE ${name} AS ENUM (\n${t.labels.map((l) => `  ${quoteLiteral(l)}`).join(',\n')}\n);`
    case 'composite':
      return `CREATE TYPE ${name} AS (\n${t.attributes.map((a) => `  ${q(a.name)} ${a.type}`).join(',\n')}\n);`
    case 'range':
      return `CREATE TYPE ${name} AS RANGE (SUBTYPE = ${t.baseType});`
    case 'domain': {
      const clauses = [
        t.defaultValue !== null ? `DEFAULT ${t.defaultValue}` : '',
        t.isNotNull ? 'NOT NULL' : '',
        ...t.checks.map((c) => c.definition)
      ].filter(Boolean)
      return `CREATE DOMAIN ${name} AS ${t.baseType}${clauses.map((c) => `\n  ${c}`).join('')};`
    }
  }
}

/**
 * Lists the user-defined types of a schema: enums, composites, domains and ranges.
 * Row types implicitly created for tables and views are skipped (only `relkind = 'c'`
 * composites were declared with `CREATE TYPE`), as are array and multirange types.
 */
export async function fetchTypes(pool: pg.Pool, schema: string): Promise<TypeInfo[]> {
  const r = await pool.query(
    `SELECT t.typname AS name, t.typtype AS kind, pg_get_userbyid(t.typowner) AS owner,
            obj_description(t.oid, 'pg_type') AS comment,
            ARRAY(SELECT e.enumlabel::text FROM pg_enum e WHERE e.enumtypid = t.oid ORDER BY e.enumsortorder) AS labels,
            COALESCE((SELECT json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod)) ORDER BY a.attnum)
                      FROM pg_attribute a WHERE a.attrelid = t.typrelid AND a.attnum > 0 AND NOT a.attisdropped), '[]') AS attributes,
            CASE t.typtype WHEN 'd' THEN format_type(t.typbasetype, t.typtypmod) WHEN 'r' THEN format_type(rg.rngsubtype, NULL) END AS base_type,
            t.typnotnull AS not_null, t.typdefault AS default_value,
            COALESCE((SELECT json_agg(json_build_object('name', c.conname, 'definition', pg_get_constraintdef(c.oid)) ORDER BY c.conname)
                      FROM pg_constraint c WHERE c.contypid = t.oid AND c.contype = 'c'), '[]') AS checks
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     LEFT JOIN pg_class rel ON rel.oid = t.typrelid
     LEFT JOIN pg_range rg ON rg.rngtypid = t.oid
     WHERE n.nspname = $1 AND t.typtype IN ('e', 'c', 'd', 'r') AND (t.typtype <> 'c' OR rel.relkind = 'c')
     ORDER BY t.typname`, [schema])
  return r.rows.map((x): TypeInfo => {
    const info: Omit<TypeInfo, 'definition'> = {
      schema, name: x.name, kind: KINDS[x.kind], owner: x.owner, comment: x.comment,
      labels: x.labels, attributes: x.attributes, baseType: x.base_type,
      isNotNull: x.not_null, defaultValue: x.default_value, checks: x.checks
    }
    return { ...info, definition: buildTypeDefinition(info) }
  })
}

/**
 * Alters a user-defined type, rolling every statement back if one fails so a
 * half-applied edit never leaves the type in an intermediate state.
 *
 * @throws The first PostgreSQL error, e.g. a value already present or a type in use.
 */
export async function alterType(pool: pg.Pool, target: TypeTarget, alterations: TypeAlteration[]): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // ADD VALUE is allowed in a transaction since PostgreSQL 12, as long as the new label is not used before COMMIT.
    for (const statement of buildAlterTypeStatements(target, alterations)) await client.query(statement)
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
