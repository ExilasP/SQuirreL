import { useState } from 'react'
import { ChevronRight, Copy, Database, Eye, FileCode2, FolderClosed, Network, Pencil, Plus, Power, Table2, Trash2, Users } from 'lucide-react'
import { parseConnectionKey, type ConnectionConfig, type SavedQuery } from '@shared/types'
import { useStore } from '@/lib/store'
import { ConnectionDialog } from './ConnectionDialog'
import { NameDialog } from './NameDialog'
import { TreeRow } from './TreeRow'

export function Sidebar() {
  const { connections, savedQueries, openSavedQuery, renameSavedQuery, removeSavedQuery, opened, openConnection, closeConnection, removeConnection, openDatabase, databaseKeyOf, openTab, openRoles, openNewQuery } = useStore()
  const [dialog, setDialog] = useState<ConnectionConfig | 'new' | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState('')
  const [tableMenu, setTableMenu] = useState<TableMenuTarget | null>(null)
  const [renaming, setRenaming] = useState<SavedQuery | null>(null)
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))
  /** Fold state of database nodes; a database that was never touched falls back to `fallback`. */
  const [unfoldedMap, setUnfolded] = useState<Record<string, boolean>>({})
  const unfolded = (k: string, fallback: boolean) => unfoldedMap[k] ?? fallback
  const toggleUnfolded = (k: string, fallback: boolean) => setUnfolded((m) => ({ ...m, [k]: !(m[k] ?? fallback) }))

  return (
    <aside className="w-72 shrink-0 bg-panel border-r border-line flex flex-col">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
        <Database size={16} className="text-accent" />
        <span className="font-semibold tracking-tight">SQuirreL</span>
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
          const isUnfolded = !!node && !collapsed[c.id]
          return (
            <div key={c.id} className="mb-1">
              <TreeRow depth={0} icon={Database} label={c.name} isExpanded={isUnfolded} dotColor={node ? c.color : '#3a4050'} tag={c.driver === 'postgres' ? 'pg' : 'sqlite'}
                onClick={() => (node ? toggle(c.id) : openConnection(c.id))}
                actions={<>
                  <button className="btn ghost !p-1" title="Edit" onClick={() => setDialog(c)}><Pencil size={12} /></button>
                  {node && <button className="btn ghost !p-1" title="Disconnect" onClick={() => closeConnection(c.id)}><Power size={12} /></button>}
                  <button className="btn ghost danger !p-1" title="Delete" onClick={() => confirm(`Delete "${c.name}"?`) && removeConnection(c.id)}><Trash2 size={12} /></button>
                </>} />
              {isUnfolded && (
                <>
                  {c.driver === 'postgres' && <TreeRow depth={1} icon={Users} label="Roles" onClick={() => openRoles(c.id)} />}
                  {c.driver !== 'postgres' && <TreeRow depth={1} icon={FileCode2} label="New query" onClick={() => openNewQuery(c.id)} />}
                  <SavedQueries queries={savedQueries.filter((q) => parseConnectionKey(q.connId).connId === c.id && q.name.toLowerCase().includes(filter.toLowerCase()))}
                    isCollapsed={!!collapsed[`${c.id}:queries`]} onToggle={() => toggle(`${c.id}:queries`)}
                    onOpen={openSavedQuery} onRename={setRenaming} onRemove={(q) => confirm(`Delete "${q.name}"?`) && removeSavedQuery(q.id)}
                    onDuplicate={(q) => openTab({ id: `q:${q.connId}:${Date.now()}`, kind: 'query', connId: q.connId, title: `${q.name} copy`, sql: q.sql, savedId: null, savedSql: '' })} />
                  {c.driver === 'postgres'
                    ? node.databases.map((database) => {
                      const key = databaseKeyOf(c.id, database); const isDefault = key === c.id
                      const isDbUnfolded = unfolded(`db:${key}`, isDefault) && !!opened[key]
                      return (
                        <div key={database}>
                          <TreeRow depth={1} icon={Database} label={database} isExpanded={isDbUnfolded}
                            onClick={() => { if (!opened[key]) { setUnfolded((m) => ({ ...m, [`db:${key}`]: true })); openDatabase(c.id, database) } else toggleUnfolded(`db:${key}`, isDefault) }} />
                          {isDbUnfolded && (
                            <>
                              <TreeRow depth={2} icon={FileCode2} label="New query" onClick={() => openNewQuery(key)} />
                              <DatabaseTree connKey={key} depth={2} showSchemas filter={filter} onTableMenu={setTableMenu} />
                            </>
                          )}
                        </div>
                      )
                    })
                    : <DatabaseTree connKey={c.id} depth={1} showSchemas={node.schemas.length > 1} filter={filter} onTableMenu={setTableMenu} />}
                </>
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

interface TableMenuTarget { x: number; y: number; connId: string; schema: string; table: string }

interface DatabaseTreeProps {
  /** Key of the opened database in the store (see `databaseKey`). */
  connKey: string
  depth: number
  /** Group tables under a folder per schema; SQLite has a single implicit one. */
  showSchemas: boolean
  filter: string
  onTableMenu(target: TableMenuTarget): void
}

/** Schemas of one opened database, each folding its diagram entry and its tables. */
function DatabaseTree({ connKey, depth, showSchemas, filter, onTableMenu }: DatabaseTreeProps) {
  const { opened, loadTables, openTab, openTable } = useStore()
  const [unfoldedMap, setUnfolded] = useState<Record<string, boolean>>({})
  const node = opened[connKey]
  if (!node) return null

  const renderSchema = (schema: string, index: number) => {
    const tables = node.tables[schema]
    // The first schema is loaded on open and starts unfolded.
    const isUnfolded = (!showSchemas || (unfoldedMap[schema] ?? index === 0)) && !!tables
    const childDepth = showSchemas ? depth + 1 : depth
    const shown = tables?.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))
    const onToggle = () => {
      if (!tables) loadTables(connKey, schema)
      setUnfolded((m) => ({ ...m, [schema]: tables ? !(m[schema] ?? index === 0) : true }))
    }
    return (
      <div key={schema}>
        {showSchemas && <TreeRow depth={depth} icon={FolderClosed} label={schema} count={tables?.length} isExpanded={isUnfolded} onClick={onToggle} />}
        {isUnfolded && (
          <>
            <TreeRow depth={childDepth} icon={Network} label="Diagram"
              onClick={() => openTab({ id: `d:${connKey}:${schema}`, kind: 'diagram', connId: connKey, schema, title: `ER · ${schema}` })} />
            {shown?.map((t) => (
              <TreeRow key={t.name} depth={childDepth} icon={t.kind === 'view' ? Eye : Table2} label={t.name}
                onClick={() => openTable(connKey, schema, t.name)}
                onContextMenu={(e) => { e.preventDefault(); onTableMenu({ x: e.clientX, y: e.clientY, connId: connKey, schema, table: t.name }) }} />
            ))}
          </>
        )}
      </div>
    )
  }
  return <>{node.schemas.map(renderSchema)}</>
}
