import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
      '@config': path.resolve(__dirname, './src/client/config'),
      '@craft-agent/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@craft-agent/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@craft-agent/core': path.resolve(__dirname, '../../packages/core/src')
    }
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
})
