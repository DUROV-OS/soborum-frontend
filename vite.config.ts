import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const devProxy = process.env.VITE_DEV_PROXY ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: devProxy, changeOrigin: true },
      '/files': { target: devProxy, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
