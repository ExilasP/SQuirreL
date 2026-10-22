export type { ExportFormat } from '@shared/types'

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const csvHeader = (columns: string[]): string => columns.map(cell).join(',') + '\r\n'
export const csvRows = (columns: string[], rows: Record<string, unknown>[]): string =>
  rows.map((r) => columns.map((c) => cell(r[c])).join(',') + '\r\n').join('')
