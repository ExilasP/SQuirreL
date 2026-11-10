import type { CsvCell, CsvFormat, CsvPreview } from '@shared/types'

const QUOTE = '"'
const CANDIDATE_DELIMITERS = [',', ';', '\t', '|']
const PREVIEW_ROWS = 5

/**
 * Splits CSV text into records (RFC 4180: quoted fields may contain the
 * delimiter, line breaks and doubled quotes).
 *
 * @param text - Whole file content, without byte order mark.
 * @param format - Delimiter and NULL handling.
 * @returns One array of cells per record; blank lines are dropped.
 * @throws If a quoted field is never closed.
 */
export function parseCsv(text: string, format: Pick<CsvFormat, 'delimiter' | 'emptyAsNull' | 'nullMarker'>): CsvCell[][] {
  const records: CsvCell[][] = []
  let record: CsvCell[] = []
  let field = ''
  let isQuoted = false
  let i = 0

  // Only unquoted fields can mean NULL, as in PostgreSQL's COPY ... CSV.
  const isNull = () => !isQuoted && (field === '' ? format.emptyAsNull : field === format.nullMarker)
  const endField = () => {
    record.push(isNull() ? null : field)
    field = ''; isQuoted = false
  }
  const endRecord = () => {
    const isBlankLine = record.length === 0 && field === '' && !isQuoted
    endField()
    if (!isBlankLine) records.push(record)
    record = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (ch === QUOTE && field === '' && !isQuoted) {
      const close = readQuoted(text, i + 1)
      field = close.value; isQuoted = true; i = close.next
      continue
    }
    if (ch === format.delimiter) { endField(); i++; continue }
    if (ch === '\r' || ch === '\n') {
      endRecord()
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += ch; i++
  }
  if (field !== '' || isQuoted || record.length) endRecord()
  return records
}

/** Reads a quoted field starting just after its opening quote. */
function readQuoted(text: string, start: number): { value: string; next: number } {
  let value = ''
  let i = start
  while (i < text.length) {
    if (text[i] !== QUOTE) { value += text[i++]; continue }
    if (text[i + 1] === QUOTE) { value += QUOTE; i += 2; continue }
    return { value, next: i + 1 }
  }
  throw new Error('Invalid CSV: a quoted field is never closed')
}

/**
 * Guesses the delimiter from the first line: the candidate appearing most often
 * outside quotes wins, comma on a tie.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r|\n|$/)).replace(/"(?:[^"]|"")*"/g, '')
  const counts = CANDIDATE_DELIMITERS.map((d) => firstLine.split(d).length - 1)
  const best = counts.indexOf(Math.max(...counts))
  return counts[best] > 0 ? CANDIDATE_DELIMITERS[best] : ','
}

/** Removes the UTF-8 byte order mark some tools (Excel) write. */
export const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)

/** CSV records split into column names and data rows. */
export interface CsvTable { headers: string[]; rows: CsvCell[][] }

/**
 * Parses a CSV file and separates its header from the data.
 *
 * @throws If the file is empty or malformed.
 */
export function readCsvTable(text: string, format: CsvFormat): CsvTable {
  const records = parseCsv(stripBom(text), format)
  if (!records.length) throw new Error('The CSV file is empty')
  const width = Math.max(...records.map((r) => r.length))
  const headers = format.hasHeader
    ? records[0].map((h, i) => h || `column_${i + 1}`)
    : Array.from({ length: width }, (_, i) => `column_${i + 1}`)
  return { headers, rows: format.hasHeader ? records.slice(1) : records }
}

/**
 * Builds the preview shown before an import.
 *
 * @param path - File the text was read from, echoed back.
 * @param text - File content.
 * @param format - Layout; a missing delimiter is detected.
 */
export function previewCsv(path: string, text: string, format: Omit<CsvFormat, 'delimiter'> & { delimiter?: string }): CsvPreview {
  const delimiter = format.delimiter || detectDelimiter(stripBom(text))
  const { headers, rows } = readCsvTable(text, { ...format, delimiter })
  return { path, delimiter, headers, rows: rows.slice(0, PREVIEW_ROWS), rowCount: rows.length }
}

/**
 * Keeps only the CSV columns mapped to a table column.
 *
 * @param rows - Data rows; short rows are padded with NULL.
 * @param mapping - Target column per CSV column position, `null` to skip it.
 * @returns Target column names and the matching values of each row.
 * @throws If two CSV columns target the same table column.
 */
export function applyColumnMapping(rows: CsvCell[][], mapping: (string | null)[]): { columns: string[]; rows: CsvCell[][] } {
  const kept = mapping.flatMap((column, index) => (column ? [{ column, index }] : []))
  const columns = kept.map((k) => k.column)
  const duplicate = columns.find((c, i) => columns.indexOf(c) !== i)
  if (duplicate) throw new Error(`Column "${duplicate}" is mapped more than once`)
  return { columns, rows: rows.map((row) => kept.map((k) => row[k.index] ?? null)) }
}
