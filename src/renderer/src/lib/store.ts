import { create } from 'zustand'
import { databaseKey, parseConnectionKey, type ConnectionConfig, type SavedQuery, type TableRef } from '@shared/types'

export type Tab =
  | { id: string; kind: 'table'; connId: string; schema: string; table: string; title: string }
  | { id: string; kind: 'query'; connId: string; title: string; sql: string; /** Library entry this tab edits, `null` for a scratch query. */ savedId: string | null; /** Last saved text, to detect unsaved changes. */ savedSql: string }
  | { id: string; kind: 'roles'; connId: string; title: string }
  | { id: string; kind: 'types'; connId: string; schema: string; title: string }
  | { id: string; kind: 'diagram'; connId: string; schema: string; title: string; /** When set, only this table and its FK neighbours are drawn. */ focusTable?: string }

interface TreeNode {
  schemas: string[]
  tables: Record<string, TableRef[]>
  /** Databases of the server (PostgreSQL); only set on the node of the connection itself. */
  databases: string[]
}

/** Whether `key` is `connId` or a database opened through it. */
const isOfConnection = (key: string, connId: string): boolean => parseConnectionKey(key).connId === connId

interface State {
  connections: ConnectionConfig[]
  opened: Record<string, TreeNode>
  savedQueries: SavedQuery[]
  tabs: Tab[]
  activeTab: string | null
  error: string | null
  init(): Promise<void>
  saveConnection(c: ConnectionConfig): Promise<void>
  removeConnection(id: string): Promise<void>
  openConnection(id: string): Promise<void>
  closeConnection(id: string): Promise<void>
  /** Opens another database of a PostgreSQL server and loads its schemas. */
  openDatabase(connId: string, database: string): Promise<void>
  /** Key under which `database` of `connId` is opened (the connection id itself for its default database). */
  databaseKeyOf(connId: string, database: string): string
  loadTables(connId: string, schema: string): Promise<void>
  openTab(t: Tab): void
  openTable(connId: string, schema: string, table: string): void
  /** Opens (or focuses) the roles and users tab of a connection. */
  openRoles(connId: string): void
  /** Opens (or focuses) the user-defined types tab of a schema. */
  openTypes(connId: string, schema: string): void
  /** Opens a blank query tab on `connId`. */
  openNewQuery(connId: string): void
  /** Opens a blank query on the active tab's connection, else the first open one. */
  newQueryOnActiveConnection(): void
  /** Activates the next (`1`) or previous (`-1`) tab, wrapping around. */
  cycleTab(direction: 1 | -1): void
  /** Activates the tab at `index`, if any. */
  goToTab(index: number): void
  closeTab(id: string): void
  setActive(id: string): void
  /** Saves a query tab to the library; `name` is required the first time. */
  saveQueryTab(tabId: string, name?: string): Promise<void>
  openSavedQuery(q: SavedQuery): void
  renameSavedQuery(q: SavedQuery, name: string): Promise<void>
  removeSavedQuery(id: string): Promise<void>
  patchQuery(id: string, p: Partial<Extract<Tab, { kind: 'query' }>>): void
  setError(e: string | null): void
}

const msg = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/i, '')

export const useStore = create<State>((set, get) => ({
  connections: [], savedQueries: [], opened: {}, tabs: [], activeTab: null, error: null,
  async init() {
    const [connections, savedQueries] = await Promise.all([window.api.connections.list(), window.api.queries.list()])
    set({ connections, savedQueries })
  },
  async saveConnection(c) { set({ connections: await window.api.connections.save(c) }) },
  async removeConnection(id) {
    set({ connections: await window.api.connections.remove(id) })
    const { opened, tabs } = get()
    set({ opened: Object.fromEntries(Object.entries(opened).filter(([key]) => !isOfConnection(key, id))), tabs: tabs.filter((t) => !isOfConnection(t.connId, id)), savedQueries: await window.api.queries.list() })
  },
  async openConnection(id) {
    try {
      await window.api.connections.open(id)
      const [schemas, databases] = await Promise.all([window.api.db.schemas(id), window.api.db.databases(id)])
      set((s) => ({ opened: { ...s.opened, [id]: { schemas, databases, tables: {} } } }))
      await Promise.all(schemas.slice(0, 1).map((sc) => get().loadTables(id, sc)))
    } catch (e) { set({ error: msg(e) }) }
  },
  async closeConnection(id) {
    await window.api.connections.close(id)
    const { opened, tabs } = get()
    set({ opened: Object.fromEntries(Object.entries(opened).filter(([key]) => !isOfConnection(key, id))), tabs: tabs.filter((t) => !isOfConnection(t.connId, id)) })
  },
  databaseKeyOf(connId, database) {
    return get().connections.find((c) => c.id === connId)?.database === database ? connId : databaseKey(connId, database)
  },
  async openDatabase(connId, database) {
    const key = get().databaseKeyOf(connId, database)
    if (get().opened[key]) return
    try {
      await window.api.connections.open(key)
      const schemas = await window.api.db.schemas(key)
      set((s) => ({ opened: { ...s.opened, [key]: { schemas, databases: [], tables: {} } } }))
      if (schemas[0]) await get().loadTables(key, schemas[0])
    } catch (e) { set({ error: msg(e) }) }
  },
  async loadTables(connId, schema) {
    const tables = await window.api.db.tables(connId, schema)
    set((s) => ({ opened: { ...s.opened, [connId]: { ...s.opened[connId], tables: { ...s.opened[connId].tables, [schema]: tables } } } }))
  },
  openTab(t) {
    const exists = get().tabs.find((x) => x.id === t.id)
    set({ tabs: exists ? get().tabs : [...get().tabs, t], activeTab: t.id })
  },
  openTable(connId, schema, table) {
    get().openTab({ id: `t:${connId}:${schema}.${table}`, kind: 'table', connId, schema, table, title: table })
  },
  openRoles(connId) {
    get().openTab({ id: `r:${connId}`, kind: 'roles', connId, title: 'Roles' })
  },
  openTypes(connId, schema) {
    get().openTab({ id: `ty:${connId}:${schema}`, kind: 'types', connId, schema, title: `Types · ${schema}` })
  },
  openNewQuery(connId) {
    get().openTab({ id: `q:${connId}:${Date.now()}`, kind: 'query', connId, title: 'Query', sql: '', savedId: null, savedSql: '' })
  },
  newQueryOnActiveConnection() {
    const { tabs, activeTab, opened } = get()
    const activeConnId = tabs.find((t) => t.id === activeTab)?.connId
    const connId = activeConnId && opened[activeConnId] ? activeConnId : Object.keys(opened)[0]
    if (connId) get().openNewQuery(connId)
    else set({ error: 'Open a connection first to create a query.' })
  },
  cycleTab(direction) {
    const { tabs, activeTab } = get()
    if (tabs.length === 0) return
    const current = tabs.findIndex((t) => t.id === activeTab)
    set({ activeTab: tabs[(current + direction + tabs.length) % tabs.length].id })
  },
  goToTab(index) {
    const tab = get().tabs[index]
    if (tab) set({ activeTab: tab.id })
  },
  closeTab(id) {
    const { tabs, activeTab } = get(); const i = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    set({ tabs: next, activeTab: activeTab === id ? (next[Math.min(i, next.length - 1)]?.id ?? null) : activeTab })
  },
  async saveQueryTab(tabId, name) {
    const tab = get().tabs.find((t) => t.id === tabId)
    if (tab?.kind !== 'query') return
    const existing = get().savedQueries.find((q) => q.id === tab.savedId)
    const finalName = name ?? existing?.name
    if (!finalName) return
    const query: SavedQuery = { id: existing?.id ?? crypto.randomUUID(), connId: tab.connId, name: finalName, sql: tab.sql, updatedAt: Date.now() }
    set({ savedQueries: await window.api.queries.save(query) })
    get().patchQuery(tabId, { savedId: query.id, savedSql: query.sql, title: query.name })
  },
  openSavedQuery(q) {
    get().openTab({ id: `q:${q.id}`, kind: 'query', connId: q.connId, title: q.name, sql: q.sql, savedId: q.id, savedSql: q.sql })
  },
  async renameSavedQuery(q, name) {
    set({ savedQueries: await window.api.queries.save({ ...q, name, updatedAt: Date.now() }) })
    set((s) => ({ tabs: s.tabs.map((t) => (t.kind === 'query' && t.savedId === q.id ? { ...t, title: name } : t)) }))
  },
  async removeSavedQuery(id) {
    set({ savedQueries: await window.api.queries.remove(id) })
    // Keep open tabs as scratch queries so no text is lost.
    set((s) => ({ tabs: s.tabs.map((t) => (t.kind === 'query' && t.savedId === id ? { ...t, savedId: null, savedSql: '' } : t)) }))
  },
  setActive: (id) => set({ activeTab: id }),
  patchQuery: (id, p) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id && t.kind === 'query' ? { ...t, ...p } : t)) })),
  setError: (error) => set({ error })
}))

export { msg as errMessage }
