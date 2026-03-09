import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // DevTools는 개발 환경에서만 활성화
    ...(mode === 'development' ? [vueDevTools()] : []),
  ],
  server: {
    // 개발 서버 프록시 (npm run dev 시에만 사용)
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  },
  build: {
    // 소스맵 비활성화 (운영 서버에서 내부 코드 노출 방지)
    sourcemap: false,
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
}))
