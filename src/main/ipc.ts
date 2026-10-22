import { dialog, ipcMain } from 'electron'
import { appendFile, readFile, writeFile } from 'fs/promises'
import type { ConnectionConfig, RowsRequest } from '@shared/types'
import { createDriver } from './drivers'
import type { Driver } from './drivers/types'
import { csvHeader, csvRows, type ExportFormat } from './export'
import { loadConnections, saveConnections } from './store'

const open = new Map<string, Driver>()
const get = (id: string): Driver => {
  const d = open.get(id)
  if (!d) throw new Error('Connection is not open')
  return d
}

export function registerIpc(): void {
  const h = (channel: string, fn: (...args: any[]) => unknown) => ipcMain.handle(channel, (_e, ...a) => fn(...a))

  h('connections:list', () => loadConnections())
  h('connections:save', (c: ConnectionConfig) => {
    const list = loadConnections()
    const i = list.findIndex((x) => x.id === c.id)
    if (i >= 0) list[i] = c; else list.push(c)
    saveConnections(list)
    return list
  })
  h('connections:remove', async (id: string) => {
    await open.get(id)?.disconnect(); open.delete(id)
    const list = loadConnections().filter((c) => c.id !== id)
    saveConnections(list)
    return list
  })
  h('connections:test', async (c: ConnectionConfig) => {
    const d = createDriver(c)
    try { await d.connect(); return { ok: true } }
    catch (e) { return { ok: false, error: (e as Error).message } }
    finally { await d.disconnect().catch(() => {}) }
  })
  h('connections:open', async (id: string) => {
    if (open.has(id)) return
    const cfg = loadConnections().find((c) => c.id === id)
    if (!cfg) throw new Error('Unknown connection')
    const d = createDriver(cfg); await d.connect(); open.set(id, d)
  })
  h('connections:close', async (id: string) => { await open.get(id)?.disconnect(); open.delete(id) })
  h('connections:pickFile', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'promptToCreate'], filters: [{ name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3', 'db3'] }, { name: 'All', extensions: ['*'] }] })
    return r.canceled ? null : r.filePaths[0]
  })

  h('db:schemas', (id) => get(id).listSchemas())
  h('db:tables', (id, s) => get(id).listTables(s))
  h('db:describe', (id, s, t) => get(id).describeTable(s, t))
  h('db:graph', (id, s) => get(id).graph(s))
  h('db:triggers', (id, s, t) => get(id).listTriggers(s, t))
  h('db:ddl', (id, s, t) => get(id).getDdl(s, t))
  h('db:rows', (id, req) => get(id).rows(req))
  h('db:query', (id, sql) => get(id).query(sql))
  h('db:update', (id, c) => get(id).update(c))
  h('db:insert', (id, s, t, v) => get(id).insert(s, t, v))
  h('db:remove', (id, s, t, k) => get(id).remove(s, t, k))

  const askPath = async (name: string, format: ExportFormat): Promise<string | null> => {
    const r = await dialog.showSaveDialog({ defaultPath: `${name}.${format}`, filters: [{ name: format.toUpperCase(), extensions: [format] }] })
    return r.canceled || !r.filePath ? null : r.filePath
  }
  // Whole table (all pages, streamed in chunks so big tables don't blow up memory).
  h('export:table', async (id: string, req: Omit<RowsRequest, 'limit' | 'offset'>, format: ExportFormat) => {
    const path = await askPath(req.table, format); if (!path) return null
    const CHUNK = 5000; let offset = 0; let count = 0
    await writeFile(path, '')
    for (;;) {
      const res = await get(id).rows({ ...req, limit: CHUNK, offset })
      const last = res.rows.length < CHUNK
      if (format === 'csv') await appendFile(path, (offset === 0 ? csvHeader(res.columns) : '') + csvRows(res.columns, res.rows))
      else await appendFile(path, (offset === 0 ? '[\n' : '') + res.rows.map((r, i) => (count + i > 0 ? ',\n' : '') + JSON.stringify(r)).join('') + (last ? '\n]\n' : ''))
      count += res.rows.length; offset += CHUNK
      if (last) break
    }
    return { path, count }
  })
  // Already-fetched result set (query tab).
  h('export:result', async (name: string, format: ExportFormat, columns: string[], rows: Record<string, unknown>[]) => {
    const path = await askPath(name, format); if (!path) return null
    await writeFile(path, format === 'csv' ? csvHeader(columns) + csvRows(columns, rows) : JSON.stringify(rows, null, 2) + '\n')
    return { path, count: rows.length }
  })

  h('scripts:openFile', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'SQL', extensions: ['sql'] }, { name: 'All', extensions: ['*'] }] })
    if (r.canceled) return null
    return { path: r.filePaths[0], content: await readFile(r.filePaths[0], 'utf8') }
  })
  h('scripts:saveFile', async (path: string | null, content: string) => {
    let p = path
    if (!p) {
      const r = await dialog.showSaveDialog({ defaultPath: 'script.sql', filters: [{ name: 'SQL', extensions: ['sql'] }] })
      if (r.canceled || !r.filePath) return null
      p = r.filePath
    }
    await writeFile(p, content, 'utf8'); return p
  })
}
