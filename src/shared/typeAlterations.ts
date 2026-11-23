import { quoteIdent as q, quoteLiteral } from './sql'
import type { TypeAlteration, TypeTarget } from './types'

/** A check typed as `CHECK (...)` is kept as-is; a bare expression gets wrapped. */
const toCheckClause = (expression: string): string => {
  const trimmed = expression.trim()
  return /^check\b/i.test(trimmed) ? trimmed : `CHECK (${trimmed})`
}

/** SQL for one alteration, given the qualified name and the `ALTER` keyword of the type. */
function buildStatement(target: TypeTarget, alteration: TypeAlteration): string {
  const name = `${q(target.schema)}.${q(target.name)}`
  const objectKind = target.kind === 'domain' ? 'DOMAIN' : 'TYPE'
  const alter = `ALTER ${objectKind} ${name}`
  switch (alteration.op) {
    case 'rename': return `${alter} RENAME TO ${q(alteration.newName)};`
    case 'setOwner': return `${alter} OWNER TO ${q(alteration.owner)};`
    case 'setComment':
      return `COMMENT ON ${objectKind} ${name} IS ${alteration.comment === null ? 'NULL' : quoteLiteral(alteration.comment)};`
    case 'addEnumValue': {
      const { placement } = alteration
      const where = placement ? ` ${placement.position.toUpperCase()} ${quoteLiteral(placement.neighbor)}` : ''
      return `${alter} ADD VALUE ${quoteLiteral(alteration.value)}${where};`
    }
    case 'renameEnumValue': return `${alter} RENAME VALUE ${quoteLiteral(alteration.from)} TO ${quoteLiteral(alteration.to)};`
    case 'addAttribute': return `${alter} ADD ATTRIBUTE ${q(alteration.name)} ${alteration.type.trim()};`
    case 'dropAttribute': return `${alter} DROP ATTRIBUTE ${q(alteration.name)};`
    case 'renameAttribute': return `${alter} RENAME ATTRIBUTE ${q(alteration.from)} TO ${q(alteration.to)};`
    case 'alterAttributeType': return `${alter} ALTER ATTRIBUTE ${q(alteration.name)} TYPE ${alteration.type.trim()};`
    case 'setDefault':
      return alteration.expression === null ? `${alter} DROP DEFAULT;` : `${alter} SET DEFAULT ${alteration.expression.trim()};`
    case 'setNotNull': return `${alter} ${alteration.isNotNull ? 'SET' : 'DROP'} NOT NULL;`
    case 'addCheck': return `${alter} ADD ${toCheckClause(alteration.expression)};`
    case 'dropCheck': return `${alter} DROP CONSTRAINT ${q(alteration.name)};`
  }
}

/**
 * Translates alterations of a PostgreSQL user-defined type into SQL statements.
 *
 * A `rename` changes the name used by every later statement, so alterations can
 * be listed in any order.
 *
 * @param target - Type being altered, with its current name.
 * @param alterations - Changes to apply, in order.
 * @returns One statement per alteration, ready to run in a single transaction.
 */
export function buildAlterTypeStatements(target: TypeTarget, alterations: TypeAlteration[]): string[] {
  let current = target
  return alterations.map((alteration) => {
    const statement = buildStatement(current, alteration)
    if (alteration.op === 'rename') current = { ...current, name: alteration.newName }
    return statement
  })
}
