import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CsvFormat, CsvPreview, TableDetail } from '@shared/types'
import { errMessage } from '@/lib/store'
import { CSV_DELIMITERS, guessColumnMapping } from '@/lib/csvMapping'

/** Dialog importing a CSV file (e.g. a pgAdmin export) into an existing table. */
export function ImportDialog({ connId, detail, path, onDone, onClose }: {
  connId: string
  detail: TableDetail
  /** CSV file already chosen by the user. */
  path: string
  /** Called with the number of imported rows once the transaction committed. */
  onDone(count: number): void
  onClose(): void
}) {
  const [format, setFormat] = useState<Omit<CsvFormat, 'delimiter'> & { delimiter?: string }>({ hasHeader: true, emptyAsNull: true })
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [mapping, setMapping] = useState<(string | null)[]>([])
  const [truncate, setTruncate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const columnNames = detail.columns.map((c) => c.name)

  useEffect(() => {
    let isCurrent = true
    window.api.import.previewCsv(path, format).then((p) => {
      if (!isCurrent) return
      setPreview(p); setError(null)
      setMapping(guessColumnMapping(p.headers, detail.columns.map((c) => c.name)))
    }).catch((e) => { if (isCurrent) { setPreview(null); setError(errMessage(e)) } })
    return () => { isCurrent = false }
  }, [path, format, detail])

  const mappedCount = mapping.filter(Boolean).length
  const submit = async () => {
    if (!preview) return
    if (truncate && !confirm(`Delete every row of ${detail.name} before importing?`)) return
    setBusy(true); setError(null)
    try {
      const r = await window.api.import.csv(connId, {
        path, schema: detail.schema, table: detail.name, mapping, truncate,
        format: { ...format, delimiter: preview.delimiter }
      })
      onDone(r.count); onClose()
    } catch (e) { setError(errMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50" onMouseDown={onClose}>
      <div className="w-[720px] max-h-[85vh] flex flex-col bg-panel border border-line rounded-xl shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-base font-semibold">Import CSV · {detail.name}</h2>
          <button className="btn ghost !p-1" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-auto">
          <div className="text-dim text-xs font-mono truncate" title={path}>{path}</div>
          <FormatOptions format={format} detected={preview?.delimiter} onChange={setFormat} />
          {error && <div className="text-danger text-xs whitespace-pre-wrap">{error}</div>}
          {preview && <ColumnMapping preview={preview} columns={columnNames} mapping={mapping} onChange={setMapping} />}
          <label className="flex items-center gap-2 text-dim">
            <input type="checkbox" checked={truncate} onChange={(e) => setTruncate(e.target.checked)} /> Empty the table before importing
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line">
          {preview && <span className="mr-auto text-dim text-xs">{preview.rowCount.toLocaleString()} rows · {mappedCount} / {preview.headers.length} columns mapped</span>}
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !preview || !mappedCount} onClick={submit}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      </div>
    </div>
  )
}

function FormatOptions({ format, detected, onChange }: {
  format: Omit<CsvFormat, 'delimiter'> & { delimiter?: string }
  /** Delimiter in use, shown when the user left it on auto-detection. */
  detected?: string
  onChange(format: Omit<CsvFormat, 'delimiter'> & { delimiter?: string }): void
}) {
  const detectedLabel = CSV_DELIMITERS.find((d) => d.value === detected)?.label
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="flex items-center gap-2">
        <span className="text-dim">Delimiter</span>
        <select className="field !w-44" value={format.delimiter ?? ''} onChange={(e) => onChange({ ...format, delimiter: e.target.value || undefined })}>
          <option value="">Auto{!format.delimiter && detectedLabel ? ` — ${detectedLabel}` : ''}</option>
          {CSV_DELIMITERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-dim">
        <input type="checkbox" checked={format.hasHeader} onChange={(e) => onChange({ ...format, hasHeader: e.target.checked })} /> Header row
      </label>
      <label className="flex items-center gap-2 text-dim" title="An unquoted empty field becomes NULL; a quoted &quot;&quot; stays an empty string">
        <input type="checkbox" checked={format.emptyAsNull} onChange={(e) => onChange({ ...format, emptyAsNull: e.target.checked })} /> Empty field = NULL
      </label>
    </div>
  )
}

/** Shows NULL and empty string differently, since the import keeps them apart. */
const formatSample = (cell: string | null | undefined): string => (cell == null ? 'NULL' : cell === '' ? '""' : cell)

/** One row per CSV column: target table column picker and the first sample values. */
function ColumnMapping({ preview, columns, mapping, onChange }: {
  preview: CsvPreview
  columns: string[]
  mapping: (string | null)[]
  onChange(mapping: (string | null)[]): void
}) {
  const setTarget = (index: number, column: string | null) => onChange(mapping.map((m, i) => (i === index ? column : m)))
  return (
    <table className="w-full text-xs">
      <thead className="text-dim text-left">
        <tr><th className="py-1 font-medium">CSV column</th><th className="py-1 font-medium">Table column</th><th className="py-1 font-medium">Sample</th></tr>
      </thead>
      <tbody>
        {preview.headers.map((header, index) => (
          <tr key={index} className="border-t border-line">
            <td className="py-1 pr-3 font-mono">{header}</td>
            <td className="py-1 pr-3">
              <select className="field !py-1 font-mono" value={mapping[index] ?? ''} onChange={(e) => setTarget(index, e.target.value || null)}>
                <option value="">— skip —</option>
                {columns.map((c) => <option key={c} value={c} disabled={c !== mapping[index] && mapping.includes(c)}>{c}</option>)}
              </select>
            </td>
            <td className="py-1 font-mono text-dim truncate max-w-[260px]">
              {preview.rows.map((row) => formatSample(row[index])).join(' · ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
