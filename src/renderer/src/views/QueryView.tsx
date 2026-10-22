import { useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql as sqlLang, PostgreSQL, SQLite } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { Play, Save, FolderOpen } from 'lucide-react'
import type { QueryResult } from '@shared/types'
import { errMessage, useStore, type Tab } from '@/lib/store'
import { Grid } from '@/components/Grid'
import { ExportMenu } from '@/components/ExportMenu'

export function QueryView({ tab }: { tab: Extract<Tab, { kind: 'query' }> }) {
  const { patchQuery, connections } = useStore()
  const driver = connections.find((c) => c.id === tab.connId)?.driver
  const [res, setRes] = useState<QueryResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [sel, setSel] = useState('')

  const run = async (text = sel || tab.sql) => {
    if (!text.trim()) return
    setRunning(true); setErr(null)
    try { setRes(await window.api.db.query(tab.connId, text)) }
    catch (e) { setErr(errMessage(e)); setRes(null) }
    finally { setRunning(false) }
  }

  const runRef = useRef(run)
  runRef.current = run

  const extensions = useMemo(() => [
    sqlLang({ dialect: driver === 'postgres' ? PostgreSQL : SQLite }),
    // highest precedence: the default keymap binds Mod-Enter to "insert blank line"
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { runRef.current(); return true } }]))
  ], [driver])

  const save = async () => {
    const p = await window.api.scripts.saveFile(tab.path, tab.sql)
    if (p) patchQuery(tab.id, { path: p, title: p.split(/[\\/]/).pop()! })
  }
  const open = async () => {
    const f = await window.api.scripts.openFile()
    if (f) patchQuery(tab.id, { sql: f.content, path: f.path, title: f.path.split(/[\\/]/).pop()! })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 h-12 border-b border-line">
        <button className="btn primary" disabled={running} onClick={() => run()}><Play size={14} /> {sel ? 'Run selection' : 'Run'}</button>
        <span className="text-dim text-xs">Ctrl+Enter</span>
        <div className="ml-auto flex gap-2">
          <ExportMenu disabled={!res?.columns.length} run={(f) => window.api.export.result(tab.title, f, res!.columns, res!.rows)} />
          <button className="btn" onClick={open}><FolderOpen size={14} /> Open script</button>
          <button className="btn" onClick={save}><Save size={14} /> Save</button>
        </div>
      </div>
      <div className="h-[40%] border-b border-line overflow-auto">
        <CodeMirror value={tab.sql} height="100%" theme={oneDark} extensions={extensions} basicSetup={{ foldGutter: false }}
          onChange={(v) => patchQuery(tab.id, { sql: v })}
          onStatistics={(s) => setSel(s.selectionCode)} />
      </div>
      <div className="flex-1 min-h-0">
        {err && <pre className="p-4 text-danger font-mono whitespace-pre-wrap">{err}</pre>}
        {res && (res.columns.length
          ? <Grid columns={res.columns} rows={res.rows} />
          : <div className="p-4 text-ok">OK — {res.affected ?? 0} rows affected</div>)}
        {!res && !err && <div className="h-full grid place-items-center text-dim">Run a query to see results</div>}
      </div>
      {res && <div className="h-8 px-3 flex items-center border-t border-line text-dim text-xs">{res.rowCount} rows · {res.durationMs.toFixed(0)} ms</div>}
    </div>
  )
}
