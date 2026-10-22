import { app, safeStorage } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { ConnectionConfig, SavedQuery } from '@shared/types'

const file = () => join(app.getPath('userData'), 'connections.json')

// Passwords are encrypted with the OS keychain when available (safeStorage).
const enc = (p?: string) => (p && safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(p).toString('base64') : p)
const dec = (p?: string) => (p?.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(p.slice(4), 'base64')) : p)

export const loadConnections = (): ConnectionConfig[] => {
  if (!existsSync(file())) return []
  const list = JSON.parse(readFileSync(file(), 'utf8')) as ConnectionConfig[]
  return list.map((c) => ({ ...c, password: dec(c.password) }))
}

export const saveConnections = (list: ConnectionConfig[]): void =>
  writeFileSync(file(), JSON.stringify(list.map((c) => ({ ...c, password: enc(c.password) })), null, 2))

const queriesFile = () => join(app.getPath('userData'), 'queries.json')

export const loadQueries = (): SavedQuery[] =>
  existsSync(queriesFile()) ? (JSON.parse(readFileSync(queriesFile(), 'utf8')) as SavedQuery[]) : []

export const saveQueries = (list: SavedQuery[]): void =>
  writeFileSync(queriesFile(), JSON.stringify(list, null, 2))
