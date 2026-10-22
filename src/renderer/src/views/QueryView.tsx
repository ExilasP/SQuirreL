import { useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql as sqlLang, PostgreSQL, SQLite } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap, type EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { Play, Save, FolderOpen, Download } from 'lucide-react'
import type { QueryResult } from '@shared/types'
import { errMessage, useStore, type Tab } from '@/lib/store'
import { Grid } from '@/components/Grid'
import { NameDialog } from '@/components/NameDialog'
import { ExportMenu } from '@/components/ExportMenu'

export function QueryView({ tab }: { tab: Extract<Tab, { kind: 'query' }> }) {
  const { patchQuery, saveQueryTab, connections } = useStore()
  const driver = connections.find((c) => c.id === tab.connId)?.driver
  const [res, setRes] = useState<QueryResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [sel, setSel] = useState('')
  const [isNaming, setIsNaming] = useState(false)

  const run = async (text = sel || tab.sql) => {
    if (!text.trim()) return
    setRunning(true); setErr(null)
    try { setRes(await window.api.db.query(tab.connId, text)) }
    catch (e) { setErr(errMessage(e)); setRes(null) }
    finally { setRunning(false) }
  }

  const editorRef = useRef<EditorView | null>(null)
  const runRef = useRef(run)
  runRef.current = run

  // First save asks for a name; later saves update the library entry in place.
  const save = () => (tab.savedId ? saveQueryTab(tab.id) : setIsNaming(true))
  const saveRef = useRef(save)
  saveRef.current = save

  const extensions = useMemo(() => [
    sqlLang({ dialect: driver === 'postgres' ? PostgreSQL : SQLite }),
    // highest precedence: the default keymap binds Mod-Enter to "insert blank line"
    Prec.highest(keymap.of([
      { key: 'Mod-Enter', run: () => { runRef.current(); return true } },
      { key: 'Mod-s', run: () => { saveRef.current(); return true } }
    ]))
  ], [driver])

  // Clicking the empty area below the last line should behave like a text area:
  // focus the editor and put the caret at the end of the document.
  const focusEditorEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    const view = editorRef.current
    if (!view || (e.target as HTMLElement).closest('.cm-content')) return
    e.preventDefault()
    view.dispatch({ selection: { anchor: view.state.doc.length }, scrollIntoView: true })
    view.focus()
  }

  const importFile = async () => {
    const f = await window.api.scripts.openFile()
    if (f) patchQuery(tab.id, { sql: f.content })
  }
  const exportFile = () => window.api.scripts.saveFile(null, tab.sql)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 h-12 border-b border-line">
        <button className="btn primary" disabled={running} onClick={() => run()}><Play size={14} /> {sel ? 'Run selection' : 'Run'}</button>
        <span className="text-dim text-xs">Ctrl+Enter</span>
        <div className="ml-auto flex gap-2">
          <ExportMenu disabled={!res?.columns.length} run={(f) => window.api.export.result(tab.title, f, res!.columns, res!.rows)} />
          <button className="btn" title="Load a .sql file into this tab" onClick={importFile}><FolderOpen size={14} /> Import</button>
          <button className="btn" title="Save a copy as a .sql file" onClick={exportFile}><Download size={14} /> Export .sql</button>
          <button className="btn primary" title="Ctrl+S" onClick={save}><Save size={14} /> Save</button>
        </div>
      </div>
      <div className="h-[40%] border-b border-line overflow-auto cursor-text" onMouseDown={focusEditorEnd}>
        <CodeMirror value={tab.sql} height="100%" theme={oneDark} extensions={extensions} basicSetup={{ foldGutter: false }}
          onCreateEditor={(view) => { editorRef.current = view }}
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
      {isNaming && <NameDialog title="Save query" initial={tab.title === 'Query' ? '' : tab.title} onSubmit={(n) => saveQueryTab(tab.id, n)} onClose={() => setIsNaming(false)} />}
      {res && <div className="h-8 px-3 flex items-center border-t border-line text-dim text-xs">{res.rowCount} rows · {res.durationMs.toFixed(0)} ms</div>}
    </div>
  )
}
