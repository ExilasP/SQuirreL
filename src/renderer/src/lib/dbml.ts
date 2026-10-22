import type { ColumnInfo, ForeignKey, SchemaGraph, TableDetail } from '@shared/types'
import { filterGraphAround } from '@/lib/graph'

const quote = (name: string): string => `"${name.replace(/"/g, '\\"')}"`
const qualified = (schema: string, table: string): string => `${quote(schema)}.${quote(table)}`

const SIMPLE_TYPE = /^[\w.]+(\(\d+(,\s*\d+)?\))?$/
const formatType = (type: string): string => (SIMPLE_TYPE.test(type) ? type : quote(type))

/** Maps a SQL default expression to the DBML literal kinds: number, string or backticked expression. */
function formatDefault(expression: string): string {
  if (/^-?\d+(\.\d+)?$/.test(expression) || /^(true|false|null)$/i.test(expression)) return expression
  const stringLiteral = /^('(?:[^']|'')*')(::[\w\s."]+)?$/.exec(expression)
  return stringLiteral ? stringLiteral[1] : `\`${expression}\``
}

function columnSettings(column: ColumnInfo, isSinglePrimaryKey: boolean): string {
  const settings: string[] = []
  if (isSinglePrimaryKey) settings.push('pk')
  if (!column.nullable && !isSinglePrimaryKey) settings.push('not null')
  if (column.defaultValue !== null) settings.push(`default: ${formatDefault(column.defaultValue)}`)
  if (column.comment) settings.push(`note: '${column.comment.replace(/'/g, "\\'")}'`)
  return settings.length ? ` [${settings.join(', ')}]` : ''
}

function indexLines(table: TableDetail): string[] {
  const primaryColumns = table.columns.filter((c) => c.primaryKey).map((c) => c.name)
  const lines = primaryColumns.length > 1 ? [`    (${primaryColumns.map(quote).join(', ')}) [pk]`] : []
  for (const index of table.indexes) {
    if (index.primary || !index.columns.length) continue
    const target = index.columns.length > 1 ? `(${index.columns.map(quote).join(', ')})` : quote(index.columns[0])
    const settings = [`name: ${quote(index.name)}`, ...(index.unique ? ['unique'] : []), `type: ${index.method}`]
    lines.push(`    ${target} [${settings.join(', ')}]`)
  }
  return lines
}

function tableBlock(table: TableDetail): string {
  const isSinglePrimaryKey = table.columns.filter((c) => c.primaryKey).length === 1
  const columns = table.columns.map((c) => `  ${quote(c.name)} ${formatType(c.type)}${columnSettings(c, isSinglePrimaryKey && c.primaryKey)}`)
  const indexes = indexLines(table)
  const indexBlock = indexes.length ? ['', '  indexes {', ...indexes, '  }'] : []
  return [`Table ${qualified(table.schema, table.name)} {`, ...columns, ...indexBlock, '}'].join('\n')
}

function refLine(table: TableDetail, fk: ForeignKey): string {
  const side = (schema: string, name: string, columns: string[]) =>
    columns.length > 1 ? `${qualified(schema, name)}.(${columns.map(quote).join(', ')})` : `${qualified(schema, name)}.${quote(columns[0])}`
  const actions = [['delete', fk.onDelete], ['update', fk.onUpdate]]
    .filter(([, action]) => action && action !== 'NO ACTION').map(([kind, action]) => `${kind}: ${action.toLowerCase()}`)
  const settings = actions.length ? ` [${actions.join(', ')}]` : ''
  return `Ref ${quote(fk.name)}: ${side(table.schema, table.name, fk.columns)} > ${side(fk.refSchema, fk.refTable, fk.refColumns)}${settings}`
}

/**
 * Renders a table, its direct neighbours and the foreign keys touching it as DBML.
 *
 * @param graph - Full schema graph.
 * @param tableName - Table the export is centered on.
 * @returns DBML source; empty string if the table is not in the graph.
 */
export function toDbml(graph: SchemaGraph, tableName: string): string {
  const around = filterGraphAround(graph, tableName)
  if (!around.tables.length) return ''
  const refs = around.tables.flatMap((table) =>
    table.foreignKeys
      .filter((fk) => table.name === tableName || fk.refTable === tableName)
      .filter((fk) => around.tables.some((t) => t.name === fk.refTable))
      .map((fk) => refLine(table, fk)))
  return [...around.tables.map(tableBlock), ...refs].join('\n\n') + '\n'
}
