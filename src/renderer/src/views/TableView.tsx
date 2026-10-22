import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { QueryResult, TableDetail } from '@shared/types'
import { errMessage, useStore, type Tab } from '@/lib/store'
import { Grid } from '@/components/Grid'
import { InsertDialog } from '@/components/InsertDialog'
import { ExportMenu } from '@/components/ExportMenu'

const PAGE = 200

export function TableView({ tab }: { tab: Extract<Tab, { kind: 'table' }> }) {
  const setError = useStore((s) => s.setError)
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [res, setRes] = useState<QueryResult | null>(null)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null)
  const [where, setWhere] = useState('')
  const [applied, setApplied] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [inserting, setInserting] = useState(false)

  const detailRef = useRef<TableDetail | null>(null)
  const total = res?.total ?? 0
  const pks = useMemo(() => new Set(detail?.columns.filter((c) => c.primaryKey).map((c) => c.name)), [detail])
  const editable = detail?.kind === 'table'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = detailRef.current ?? await window.api.db.describe(tab.connId, tab.schema, tab.table)
      // Stable default order (edits would otherwise reshuffle rows): primary key first.
      const pk = d.columns.find((c) => c.primaryKey)
      const orderBy = sort ?? (pk ? { column: pk.name, dir: 'asc' as const } : undefined)
      const r = await window.api.db.rows(tab.connId, { schema: tab.schema, table: tab.table, limit: PAGE, offset: page * PAGE, orderBy, where: applied })
      detailRef.current = d; setDetail(d); setRes(r); setSelected(null)
    } catch (e) { setError(errMessage(e)) } finally { setLoading(false) }
  }, [tab, page, sort, applied, setError])
  useEffect(() => { load() }, [load])

  /** Row identity: primary key if there is one, otherwise the whole row. */
  const keyOf = (row: Record<string, unknown>) =>
    Object.fromEntries((pks.size ? [...pks] : res!.columns).map((c) => [c, row[c]]))

  const edit = async (r: number, column: string, value: unknown) => {
    try {
      await window.api.db.update(tab.connId, { schema: tab.schema, table: tab.table, key: keyOf(res!.rows[r]), values: { [column]: value } })
      await load()
    } catch (e) { setError(errMessage(e)) }
  }

  const insert = async (values: Record<string, unknown>) => {
    try {
      await window.api.db.insert(tab.connId, tab.schema, tab.table, values)
      setPage(Math.floor(total / PAGE)); await load()
    } catch (e) { setError(errMessage(e)); throw e }
  }

  const delRow = async () => {
    if (selected === null || !confirm('Delete the selected row?')) return
    try { await window.api.db.remove(tab.connId, tab.schema, tab.table, keyOf(res!.rows[selected])); await load() }
    catch (e) { setError(errMessage(e)) }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE))

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 h-12 border-b border-line">
        <input className="field !w-96 font-mono" placeholder="WHERE …   e.g.  age > 30 AND name LIKE 'A%'" value={where}
          onChange={(e) => setWhere(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPage(0); setApplied(where) } }} />
        <button className="btn" onClick={load} title="Refresh"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        {editable && <>
          <button className="btn" onClick={() => setInserting(true)}><Plus size={14} /> Row</button>
          <button className="btn danger" disabled={selected === null} onClick={delRow}><Trash2 size={14} /> Delete</button>
        </>}
        <div className="ml-auto flex items-center gap-2 text-dim">
          <ExportMenu run={(f) => window.api.export.table(tab.connId, { schema: tab.schema, table: tab.table, where: applied, orderBy: sort ?? (pks.size ? { column: [...pks][0], dir: 'asc' } : undefined) }, f)} />
          <span>{total.toLocaleString()} rows</span>
          <button className="btn !p-1" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
          <span>{page + 1} / {pages}</span>
          <button className="btn !p-1" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {res && <Grid columns={res.columns} rows={res.rows} pkColumns={pks} sort={sort} selected={selected} onSelect={setSelected}
          onSort={(c) => { setPage(0); setSort(sort?.column === c ? (sort.dir === 'asc' ? { column: c, dir: 'desc' } : null) : { column: c, dir: 'asc' }) }}
          onEdit={editable ? edit : undefined} />}
      </div>
      <div className="h-8 px-3 flex items-center gap-4 border-t border-line text-dim text-xs">
        <span>{tab.schema}.{tab.table}</span>
        {detail && <span>{detail.columns.length} columns · {detail.indexes.length} indexes · {detail.foreignKeys.length} foreign keys</span>}
        {editable && !pks.size && <span className="text-danger">No primary key — edits match on the full row</span>}
        {res && <span className="ml-auto">{res.durationMs.toFixed(0)} ms</span>}
      </div>
      {inserting && detail && <InsertDialog detail={detail} onSubmit={insert} onClose={() => setInserting(false)} />}
    </div>
  )
}
