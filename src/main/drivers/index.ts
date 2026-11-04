import type { ConnectionConfig, DriverId } from '@shared/types'
import type { Driver, DriverFactory } from './types'
import { createPostgresDriver } from './postgres'

/**
 * SQLite is left out of this build: better-sqlite3 is a native module whose
 * compilation needs Visual Studio Build Tools and Python on Windows.
 */
const registry: Partial<Record<DriverId, DriverFactory>> = {
  postgres: createPostgresDriver
}

/**
 * Instantiates the driver matching a connection's engine.
 *
 * @param cfg - Connection configuration to open.
 * @returns A driver ready to `connect()`.
 * @throws If the engine is not available in this build.
 */
export const createDriver = (cfg: ConnectionConfig): Driver => {
  const factory = registry[cfg.driver]
  if (!factory) throw new Error(`The ${cfg.driver} driver is not available in this build`)
  return factory(cfg)
}
