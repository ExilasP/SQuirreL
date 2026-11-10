import { display } from './format'

/** Widest a value column grows; longer values are truncated with an ellipsis. */
export const MAX_COLUMN_WIDTH = 420
/** Narrowest the `#` column gets, so that short pages keep a stable gutter. */
const MIN_INDEX_COLUMN_WIDTH = 40
/**
 * Characters kept from the longest value before measuring it. Values are
 * capped at {@link MAX_COLUMN_WIDTH} anyway, and measuring a huge JSON
 * document would be wasted work.
 */
const MAX_MEASURED_LENGTH = 200

/** Measures the rendered width of a text, in pixels. */
export type MeasureText = (text: string) => number

/** Horizontal room taken around the text of a cell, in pixels. */
export interface CellChrome {
  /** Padding plus borders of a value cell (body and header alike). */
  valueCell: number
  /** Padding plus borders of a `#` cell. */
  indexCell: number
  /** Room reserved for the sort arrow, so that sorting never resizes a column. */
  sortIcon: number
}

/** Fixed widths of the grid columns, in pixels. */
export interface ColumnWidths {
  /** Width of the leading `#` column. */
  index: number
  /** Width of each value column, in the order of `columns`. */
  values: number[]
}

/**
 * Computes column widths from every row of the page, not only the rendered ones.
 *
 * A virtualized grid only renders the rows in view: with an automatic table
 * layout the columns would resize while scrolling. The widest value of each
 * column (by character count, as cells use a monospace font) decides its
 * width, capped at {@link MAX_COLUMN_WIDTH}; the header label is never truncated.
 *
 * @param columns - Column names, in display order.
 * @param rows - All the rows of the page.
 * @param measureValue - Measures a body cell text (monospace font).
 * @param measureHeader - Measures a header label (sans-serif font).
 * @param chrome - Padding, borders and icons around the texts.
 * @returns The width of the `#` column and of each value column.
 */
export function computeColumnWidths(
  columns: string[],
  rows: Record<string, unknown>[],
  measureValue: MeasureText,
  measureHeader: MeasureText,
  chrome: CellChrome
): ColumnWidths {
  const values = columns.map((column) => {
    const valueWidth = Math.min(MAX_COLUMN_WIDTH, measureValue(longestValue(rows, column)) + chrome.valueCell)
    const headerWidth = measureHeader(column) + chrome.sortIcon + chrome.valueCell
    return Math.ceil(Math.max(valueWidth, headerWidth))
  })
  const index = Math.ceil(Math.max(MIN_INDEX_COLUMN_WIDTH, measureValue(String(rows.length)) + chrome.indexCell))
  return { index, values }
}

/** Longest displayed text of a column, cut to {@link MAX_MEASURED_LENGTH} characters. */
function longestValue(rows: Record<string, unknown>[], column: string): string {
  let longest = ''
  for (const row of rows) {
    const text = display(row[column])
    if (text.length > longest.length) longest = text
    if (longest.length >= MAX_MEASURED_LENGTH) break
  }
  return longest.slice(0, MAX_MEASURED_LENGTH)
}
