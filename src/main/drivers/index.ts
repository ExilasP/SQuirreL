import type { ConnectionConfig, DriverId } from '@shared/types'
import type { Driver, DriverFactory } from './types'
import { createSqliteDriver } from './sqlite'
import { createPostgresDriver } from './postgres'

const registry: Record<DriverId, DriverFactory> = {
  sqlite: createSqliteDriver,
  postgres: createPostgresDriver
}

export const createDriver = (cfg: ConnectionConfig): Driver => registry[cfg.driver](cfg)
