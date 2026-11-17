import type { ColumnInfo } from '@shared/types'
import { scoreMatch } from '@/lib/matchScore'

/** The identifier being typed at the caret, and the text range a completion replaces. */
export interface IdentifierAtCaret {
  /** Partial name typed so far (without any opening double quote). */
  prefix: string
  /** Index where the replaced range starts (includes an opening `"` if any). */
  start: number
  /** Index where the replaced range ends (end of the word, which may extend past the caret). */
  end: number
}

const IDENTIFIER_CHAR = /[\p{L}\p{N}_$]/u
/** Names that need no double quotes in both SQLite and PostgreSQL (PostgreSQL folds unquoted names to lower case). */
const BARE_IDENTIFIER = /^[a-z_][a-z0-9_$]*$/

/** Whether the caret sits inside a `'string literal'`, where completing column names makes no sense. */
function isInsideStringLiteral(text: string, caret: number): boolean {
  let isOpen = false
  for (let index = 0; index < caret; index++) if (text[index] === "'") isOpen = !isOpen
  return isOpen
}

/** Index of the `"` opening a quoted identifier still open at the caret, or -1. */
function findOpenQuote(text: string, caret: number): number {
  let openAt = -1
  for (let index = 0; index < caret; index++) {
    if (text[index] === "'" && openAt === -1) { const close = text.indexOf("'", index + 1); index = close === -1 ? caret : close; continue }
    if (text[index] === '"') openAt = openAt === -1 ? index : -1
  }
  return openAt
}

/**
 * Locates the column name being typed at the caret of a `WHERE` fragment.
 *
 * @param text - Full content of the filter input.
 * @param caret - Caret position (collapsed selection).
 * @returns The identifier under the caret, or `null` when the caret is inside a
 *   string literal or on a token that cannot be a column name (e.g. a number).
 */
export function findIdentifierAtCaret(text: string, caret: number): IdentifierAtCaret | null {
  const openQuote = findOpenQuote(text, caret)
  if (openQuote !== -1) {
    const close = text.indexOf('"', caret)
    return { prefix: text.slice(openQuote + 1, caret), start: openQuote, end: close === -1 ? caret : close + 1 }
  }
  if (isInsideStringLiteral(text, caret)) return null
  let start = caret
  while (start > 0 && IDENTIFIER_CHAR.test(text[start - 1])) start--
  let end = caret
  while (end < text.length && IDENTIFIER_CHAR.test(text[end])) end++
  const prefix = text.slice(start, caret)
  if (/^\p{N}/u.test(prefix)) return null
  return { prefix, start, end }
}

/**
 * Ranks the columns matching a typed prefix, best match first.
 *
 * @param prefix - Partial name typed by the user; empty lists every column in table order.
 * @param columns - Columns of the browsed table.
 * @param limit - Maximum number of suggestions.
 * @returns Matching columns; empty when the prefix already names a column exactly.
 */
export function suggestColumns(prefix: string, columns: ColumnInfo[], limit = 50): ColumnInfo[] {
  if (columns.some((c) => c.name === prefix)) return []
  return columns
    .map((column, order) => ({ column, order, score: scoreMatch(prefix, column.name) }))
    .filter((scored): scored is { column: ColumnInfo; order: number; score: number } => scored.score !== null)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map(({ column }) => column)
}

/** Writes a column name as SQL, double-quoting it when it is not a plain lower-case identifier. */
export function quoteColumnName(name: string): string {
  return BARE_IDENTIFIER.test(name) ? name : `"${name.replaceAll('"', '""')}"`
}

/**
 * Replaces the identifier under the caret with a chosen column name.
 *
 * @returns The new input text and the caret position right after the inserted name.
 */
export function applyColumnCompletion(text: string, target: IdentifierAtCaret, columnName: string): { text: string; caret: number } {
  const inserted = quoteColumnName(columnName)
  return { text: text.slice(0, target.start) + inserted + text.slice(target.end), caret: target.start + inserted.length }
}
