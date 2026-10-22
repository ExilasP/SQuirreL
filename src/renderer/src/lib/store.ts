import { create } from 'zustand'
import type { ConnectionConfig, TableRef } from '@shared/types'

export type Tab =
  | { id: string; kind: 'table'; connId: string; schema: string; table: string; title: string }
  | { id: string; kind: 'query'; connId: string; title: string; sql: string; path: string | null }
  | { id: string; kind: 'diagram'; connId: string; schema: string; title: string }

interface TreeNode { schemas: string[]; tables: Record<string, TableRef[]> }

interface State {
  connections: ConnectionConfig[]
  opened: Record<string, TreeNode>
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
  patchQuery(id: string, p: Partial<Extract<Tab, { kind: 'query' }>>): void
  setError(e: string | null): void
}

const msg = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/i, '')

export const useStore = create<State>((set, get) => ({
  connections: [], opened: {}, tabs: [], activeTab: null, error: null,
  async init() { set({ connections: await window.api.connections.list() }) },
  async saveConnection(c) { set({ connections: await window.api.connections.save(c) }) },
  async removeConnection(id) {
    set({ connections: await window.api.connections.remove(id) })
    const { opened, tabs } = get(); const { [id]: _, ...rest } = opened
    set({ opened: rest, tabs: tabs.filter((t) => t.connId !== id) })
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
  setActive: (id) => set({ activeTab: id }),
  patchQuery: (id, p) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id && t.kind === 'query' ? { ...t, ...p } : t)) })),
  setError: (error) => set({ error })
}))

export { msg as errMessage }
