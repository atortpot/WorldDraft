import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/game': 'http://localhost:8000',
      '/model': 'http://localhost:8000',
      '/players': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
