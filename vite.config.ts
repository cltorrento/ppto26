import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const version = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8')).version as string

export default defineConfig({
  plugins: [
    react(),
    {
      // En desarrollo, sirve /api/etf con el mismo código que usa Vercel.
      name: 'dev-api',
      configureServer(server) {
        server.middlewares.use('/api/etf', async (req, res) => {
          const mod = await server.ssrLoadModule('/api/etf.js')
          await mod.default(req, res)
        })
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
