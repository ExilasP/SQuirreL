export const display = (v: unknown): string =>
  v === null || v === undefined ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v)

/** Quotes a TSV field when it contains a tab, newline or quote, as spreadsheets expect. */
const tsvField = (value: unknown): string => {
  const text = display(value)
  return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * Serializes rows as tab-separated values, ready to paste into a spreadsheet.
 *
 * @param columns - Columns to include, in order.
 * @param rows - Rows to serialize; no header line is written.
 */
export const toTsv = (columns: string[], rows: Record<string, unknown>[]): string =>
  rows.map((row) => columns.map((c) => tsvField(row[c])).join('\t')).join('\n')
