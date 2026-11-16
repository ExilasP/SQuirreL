import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests cover the renderer's pure logic (lib/); aliases mirror electron.vite.config.ts.
export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
  test: { include: ['src/**/*.test.ts'] }
})
