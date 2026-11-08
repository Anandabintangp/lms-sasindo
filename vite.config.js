import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE diisi oleh GitHub Actions, mis. /lms-sasindo/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
