import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        rewriteWsOrigin: true,
        // Silenciar errores de conexión abortada (cliente que navega/recarga)
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') return
            console.error('[proxy error]', err.message)
          })
        }
      }
    }
  }
})