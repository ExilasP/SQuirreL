import { useState } from 'react'
import { ChevronRight, Copy, Database, Eye, FileCode2, FolderClosed, Network, Pencil, Plus, Power, Table2, Trash2 } from 'lucide-react'
import type { ConnectionConfig, SavedQuery } from '@shared/types'
import { useStore } from '@/lib/store'
import { ConnectionDialog } from './ConnectionDialog'
import { NameDialog } from './NameDialog'

export function Sidebar() {
  const { connections, savedQueries, openSavedQuery, renameSavedQuery, removeSavedQuery, opened, openConnection, closeConnection, removeConnection, loadTables, openTab, openTable, openNewQuery } = useStore()
  const [dialog, setDialog] = useState<ConnectionConfig | 'new' | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState('')
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number; connId: string; schema: string; table: string } | null>(null)
  const [renaming, setRenaming] = useState<SavedQuery | null>(null)
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))

  return (
    <aside className="w-72 shrink-0 bg-panel border-r border-line flex flex-col">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
        <Database size={16} className="text-accent" />
        <span className="font-semibold tracking-tight">DataFinder</span>
        <button className="btn ghost !p-1 ml-auto" title="New connection" onClick={() => setDialog('new')}><Plus size={16} /></button>
      </div>
      <div className="p-2"><input className="field" placeholder="Filter tables…" value={filter} onChange={(e) => setFilter(e.target.value)} /></div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {connections.length === 0 && (
          <div className="text-dim text-center mt-10 px-4">
            <p>No connections yet.</p>
            <button className="btn primary mt-3" onClick={() => setDialog('new')}><Plus size={14} /> Add connection</button>
          </div>
        )}
        {connections.map((c) => {
          const node = opened[c.id]
          return (
            <div key={c.id} className="mb-1">
              <div className="group flex items-center gap-2 px-2 h-8 rounded-md hover:bg-raised cursor-pointer"
                onClick={() => (node ? toggle(c.id) : openConnection(c.id))}>
                <ChevronRight size={14} className={`text-dim transition-transform ${node && !collapsed[c.id] ? 'rotate-90' : ''}`} />
                <span className="size-2 rounded-full" style={{ background: node ? c.color : '#3a4050' }} />
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-[10px] uppercase text-dim ml-1">{c.driver === 'postgres' ? 'pg' : 'sqlite'}</span>
                <span className="ml-auto hidden group-hover:flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button className="btn ghost !p-1" title="Edit" onClick={() => setDialog(c)}><Pencil size={12} /></button>
                  {node && <button className="btn ghost !p-1" title="Disconnect" onClick={() => closeConnection(c.id)}><Power size={12} /></button>}
                  <button className="btn ghost danger !p-1" title="Delete" onClick={() => confirm(`Delete "${c.name}"?`) && removeConnection(c.id)}><Trash2 size={12} /></button>
                </span>
              </div>
              {node && !collapsed[c.id] && (
                <div className="ml-4 border-l border-line pl-1">
                  <div className="flex gap-1 px-2 py-1">
                    <button className="btn ghost !py-0.5 text-dim" onClick={() => openNewQuery(c.id)}><FileCode2 size={13} /> New query</button>
                  </div>
                  <SavedQueries queries={savedQueries.filter((q) => q.connId === c.id && q.name.toLowerCase().includes(filter.toLowerCase()))}
                    isCollapsed={!!collapsed[`${c.id}:queries`]} onToggle={() => toggle(`${c.id}:queries`)}
                    onOpen={openSavedQuery} onRename={setRenaming} onRemove={(q) => confirm(`Delete "${q.name}"?`) && removeSavedQuery(q.id)}
                    onDuplicate={(q) => openTab({ id: `q:${c.id}:${Date.now()}`, kind: 'query', connId: c.id, title: `${q.name} copy`, sql: q.sql, savedId: null, savedSql: '' })} />
                  {node.schemas.map((sc) => {
                    const key = `${c.id}:${sc}`; const tables = node.tables[sc]
                    const shown = tables?.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))
                    return (
                      <div key={sc}>
                        {node.schemas.length > 1 && (
                          <div className="flex items-center gap-1 px-2 py-1 text-dim hover:text-fg cursor-pointer" onClick={() => { if (!tables) { setCollapsed((m) => ({ ...m, [key]: false })); loadTables(c.id, sc) } else toggle(key) }}>
                            <ChevronRight size={12} className={`transition-transform ${!collapsed[key] && tables ? 'rotate-90' : ''}`} />
                            <span className="text-xs">{sc}</span>
                          </div>
                        )}
                        <div className="px-1">
                          <button className="btn ghost !py-0.5 text-dim" onClick={() => openTab({ id: `d:${c.id}:${sc}`, kind: 'diagram', connId: c.id, schema: sc, title: `ER · ${sc}` })}><Network size={13} /> Diagram</button>
                        </div>
                        {(node.schemas.length === 1 || (!collapsed[key] && tables)) && shown?.map((t) => (
                          <div key={t.name} className="flex items-center gap-2 pl-4 pr-2 py-1 rounded-md hover:bg-raised cursor-pointer"
                            onContextMenu={(e) => { e.preventDefault(); setTableMenu({ x: e.clientX, y: e.clientY, connId: c.id, schema: sc, table: t.name }) }}
                            onClick={() => openTable(c.id, sc, t.name)}>
                            {t.kind === 'view' ? <Eye size={13} className="text-dim" /> : <Table2 size={13} className="text-dim" />}
                            <span className="truncate">{t.name}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {tableMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTableMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTableMenu(null) }} />
          <div className="fixed z-50 bg-raised border border-line rounded-md shadow-lg py-1 min-w-40" style={{ left: tableMenu.x, top: tableMenu.y }}>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent-soft" onClick={() => {
              const { connId, schema, table } = tableMenu
              openTab({ id: `d:${connId}:${schema}.${table}`, kind: 'diagram', connId, schema, title: `ER · ${table}`, focusTable: table })
              setTableMenu(null)
            }}><Network size={13} /> Show ERD</button>
          </div>
        </>
      )}
      {renaming && <NameDialog title="Rename query" initial={renaming.name} onSubmit={(n) => renameSavedQuery(renaming, n)} onClose={() => setRenaming(null)} />}
      {dialog && <ConnectionDialog initial={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} />}
    </aside>
  )
}

interface SavedQueriesProps {
  queries: SavedQuery[]
  isCollapsed: boolean
  onToggle(): void
  onOpen(q: SavedQuery): void
  onRename(q: SavedQuery): void
  onDuplicate(q: SavedQuery): void
  onRemove(q: SavedQuery): void
}

/** Collapsible "Queries" folder listing the scripts saved for one connection. */
function SavedQueries({ queries, isCollapsed, onToggle, onOpen, onRename, onDuplicate, onRemove }: SavedQueriesProps) {
  if (queries.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-1 px-2 py-1 text-dim hover:text-fg cursor-pointer" onClick={onToggle}>
        <ChevronRight size={12} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
        <FolderClosed size={12} />
        <span className="text-xs">Queries</span>
        <span className="text-[10px] ml-1">{queries.length}</span>
      </div>
      {!isCollapsed && [...queries].sort((a, b) => a.name.localeCompare(b.name)).map((q) => (
        <div key={q.id} className="group flex items-center gap-2 h-7 pl-8 pr-2 rounded-md hover:bg-raised cursor-pointer" onClick={() => onOpen(q)}>
          <FileCode2 size={13} className="text-dim shrink-0" />
          <span className="truncate">{q.name}</span>
          <span className="ml-auto hidden group-hover:flex gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button className="btn ghost !p-1" title="Rename" onClick={() => onRename(q)}><Pencil size={12} /></button>
            <button className="btn ghost !p-1" title="Duplicate" onClick={() => onDuplicate(q)}><Copy size={12} /></button>
            <button className="btn ghost danger !p-1" title="Delete" onClick={() => onRemove(q)}><Trash2 size={12} /></button>
          </span>
        </div>
      ))}
    </div>
  )
}
