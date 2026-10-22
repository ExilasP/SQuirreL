import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '@shared/types'

const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: Api = {
  connections: {
    list: call('connections:list'), save: call('connections:save'), remove: call('connections:remove'),
    test: call('connections:test'), open: call('connections:open'), close: call('connections:close'), pickFile: call('connections:pickFile')
  },
  db: {
    schemas: call('db:schemas'), tables: call('db:tables'), describe: call('db:describe'), graph: call('db:graph'),
    triggers: call('db:triggers'), ddl: call('db:ddl'),
    rows: call('db:rows'), query: call('db:query'), update: call('db:update'), insert: call('db:insert'), remove: call('db:remove')
  },
  export: { table: call('export:table'), result: call('export:result') },
  queries: { list: call('queries:list'), save: call('queries:save'), remove: call('queries:remove') },
  scripts: { openFile: call('scripts:openFile'), saveFile: call('scripts:saveFile') }
} as Api

contextBridge.exposeInMainWorld('api', api)
