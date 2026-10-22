import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { externalizeDeps: true }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { externalizeDeps: true }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()]
  }
})
