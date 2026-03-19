import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/export": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,      // Thêm dòng này cho chắc chắn
        timeout: 0,         // 0 nghĩa là không bao giờ timeout (hoặc set 300000 cho 5 phút)
        proxyTimeout: 0     // Quan trọng: thiết lập timeout cho proxy
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
        }
      }
    }
  },
  preview: {
    host: true,
    port: 4173
  }
})