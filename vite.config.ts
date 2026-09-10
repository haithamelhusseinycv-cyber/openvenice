import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/venice': {
        target: 'https://api.venice.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/venice/, ''),
      },
      // Same-origin open-model gateway in dev. Point GATEWAY_PROXY_TARGET at a
      // local llama.cpp/vLLM server (default: http://127.0.0.1:8081/v1).
      '/ai': {
        target: process.env.GATEWAY_PROXY_TARGET || 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai\/v1/, '/v1'),
      },
    },
  },
})
