/**
 * Pairs each CSV header with the table column of the same name (exact match
 * first, then ignoring case), so a pgAdmin export of the same table maps itself.
 *
 * @param headers - CSV column names, in file order.
 * @param columns - Columns of the target table.
 * @returns Target column per CSV column, `null` when nothing matches.
 */
export function guessColumnMapping(headers: string[], columns: string[]): (string | null)[] {
  const used = new Set<string>()
  const claim = (column: string | undefined) => {
    if (!column || used.has(column)) return null
    used.add(column); return column
  }
  return headers.map((header) =>
    claim(columns.find((c) => c === header)) ??
    claim(columns.find((c) => c.toLowerCase() === header.trim().toLowerCase())))
}

/** Delimiters offered in the import dialog, with a readable label. */
export const CSV_DELIMITERS: { value: string; label: string }[] = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' }
]
