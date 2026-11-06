import { useMemo, useState } from 'react'
import { Eye, FileCode2, Table2 } from 'lucide-react'
import { parseConnectionKey } from '@shared/types'
import { useStore } from '@/lib/store'
import { scoreMatch } from '@/lib/matchScore'

interface Entry {
  key: string
  name: string
  /** Where the entry lives, shown dimmed next to its name. */
  context: string
  kind: 'table' | 'view' | 'query'
  open(): void
}

const MAX_RESULTS = 50
const icons = { table: Table2, view: Eye, query: FileCode2 }

/** Ctrl+P palette: jump to any loaded table, view or saved query of an open connection. */
export function QuickOpen({ onClose }: { onClose(): void }) {
  const { connections, opened, savedQueries, openTable, openSavedQuery } = useStore()
  const [text, setText] = useState('')
  const [cursor, setCursor] = useState(0)

  const entries = useMemo<Entry[]>(() => connections.filter((c) => opened[c.id]).flatMap((c) => [
    ...Object.entries(opened).filter(([key]) => parseConnectionKey(key).connId === c.id).flatMap(([key, node]) =>
      Object.entries(node.tables).flatMap(([schema, tables]) => tables.map((t): Entry => ({
        key: `t:${key}:${schema}.${t.name}`, name: t.name, context: `${c.name} · ${parseConnectionKey(key).database ?? c.database ?? ''} · ${schema}`,
        kind: t.kind === 'view' ? 'view' : 'table', open: () => openTable(key, schema, t.name)
      })))),
    ...savedQueries.filter((q) => parseConnectionKey(q.connId).connId === c.id).map((q): Entry => ({
      key: `q:${q.id}`, name: q.name, context: c.name, kind: 'query', open: () => openSavedQuery(q)
    }))
  ]), [connections, opened, savedQueries, openTable, openSavedQuery])

  const results = useMemo(() => {
    // Rank before truncating so the most probable match is never cut off.
    return entries
      .map((entry) => ({ entry, score: scoreMatch(text, entry.name) }))
      .filter((scored): scored is { entry: Entry; score: number } => scored.score !== null)
      .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
      .slice(0, MAX_RESULTS)
      .map(({ entry }) => entry)
  }, [entries, text])

  const choose = (entry: Entry | undefined) => { if (entry) { entry.open(); onClose() } }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'Enter') choose(results[cursor])
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((i) => Math.max(i - 1, 0)) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-start pt-24 z-50" onMouseDown={onClose}>
      <div className="w-[480px] bg-panel border border-line rounded-xl shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <input className="field !rounded-none !border-0 border-b border-line" autoFocus value={text} placeholder="Search tables and queries…"
          onChange={(e) => { setText(e.target.value); setCursor(0) }} onKeyDown={onKeyDown} />
        <div className="max-h-80 overflow-auto p-1">
          {results.length === 0 && <p className="px-3 py-4 text-center text-dim">{entries.length === 0 ? 'No open connection.' : 'No match.'}</p>}
          {results.map((entry, i) => {
            const Icon = icons[entry.kind]
            return (
              <div key={entry.key} ref={(el) => { if (i === cursor) el?.scrollIntoView({ block: 'nearest' }) }}
                className={`flex items-center gap-2 px-3 h-8 rounded-md cursor-pointer ${i === cursor ? 'bg-accent-soft' : 'hover:bg-raised'}`}
                onMouseMove={() => setCursor(i)} onClick={() => choose(entry)}>
                <Icon size={13} className="text-dim shrink-0" />
                <span className="truncate">{entry.name}</span>
                <span className="ml-auto text-[10px] text-dim truncate">{entry.context}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
