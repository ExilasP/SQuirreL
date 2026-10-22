import { create } from 'zustand'
import type { ConnectionConfig, SavedQuery, TableRef } from '@shared/types'

export type Tab =
  | { id: string; kind: 'table'; connId: string; schema: string; table: string; title: string }
  | { id: string; kind: 'query'; connId: string; title: string; sql: string; /** Library entry this tab edits, `null` for a scratch query. */ savedId: string | null; /** Last saved text, to detect unsaved changes. */ savedSql: string }
  | { id: string; kind: 'diagram'; connId: string; schema: string; title: string; /** When set, only this table and its FK neighbours are drawn. */ focusTable?: string }

interface TreeNode { schemas: string[]; tables: Record<string, TableRef[]> }

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
  loadTables(connId: string, schema: string): Promise<void>
  openTab(t: Tab): void
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
    const { opened, tabs } = get(); const { [id]: _, ...rest } = opened
    set({ opened: rest, tabs: tabs.filter((t) => t.connId !== id), savedQueries: await window.api.queries.list() })
  },
  async openConnection(id) {
    try {
      await window.api.connections.open(id)
      const schemas = await window.api.db.schemas(id)
      set((s) => ({ opened: { ...s.opened, [id]: { schemas, tables: {} } } }))
      await Promise.all(schemas.slice(0, 1).map((sc) => get().loadTables(id, sc)))
    } catch (e) { set({ error: msg(e) }) }
  },
  async closeConnection(id) {
    await window.api.connections.close(id)
    const { opened, tabs } = get(); const { [id]: _, ...rest } = opened
    set({ opened: rest, tabs: tabs.filter((t) => t.connId !== id) })
  },
  async loadTables(connId, schema) {
    const tables = await window.api.db.tables(connId, schema)
    set((s) => ({ opened: { ...s.opened, [connId]: { ...s.opened[connId], tables: { ...s.opened[connId].tables, [schema]: tables } } } }))
  },
  openTab(t) {
    const exists = get().tabs.find((x) => x.id === t.id)
    set({ tabs: exists ? get().tabs : [...get().tabs, t], activeTab: t.id })
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
