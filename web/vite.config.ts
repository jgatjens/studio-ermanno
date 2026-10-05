import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { validateDeploymentEnvironment } from './deployment/config'
export default defineConfig(({ command, mode }) => {
  if (command === 'build')
    validateDeploymentEnvironment({ ...loadEnv(mode, process.cwd(), ''), ...process.env })
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 5173, strictPort: true },
    test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], clearMocks: true },
  }
})
