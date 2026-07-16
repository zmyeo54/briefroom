import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8787,
    strictPort: true,
    host: "127.0.0.1",
    // Do not open the browser automatically
    open: false,
    proxy: {
      // Health before /api/tts so it isn't swallowed by the speak proxy prefix
      "/api/tts-health": {
        target: "http://127.0.0.1:8790",
        changeOrigin: true,
        rewrite: () => "/health",
      },
      "/api/tts": {
        target: "http://127.0.0.1:8790",
        changeOrigin: true,
        rewrite: (path) => (path === "/api/tts" ? "/tts" : path),
      },
      "/api/fetch-url": {
        target: "http://127.0.0.1:8790",
        changeOrigin: true,
        rewrite: () => "/fetch-url",
      },
    },
  },
  optimizeDeps: {
    exclude: ['tesseract.js'],
  },
})
