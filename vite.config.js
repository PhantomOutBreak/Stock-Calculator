// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  // Dev proxy: ส่งทุกคำขอที่ขึ้นต้นด้วย /api ไปยัง backend (รันบน PORT 7860)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7860',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
