import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 5173,
      watch: {
        ignored: ['**/.tmp/**']
      },
      proxy: {
        '/admin/v1': {
          target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true
        },
        // 学员问答服务（apps/kb-api）。SSE 需要禁用代理缓冲，否则 delta 会被攒到最后一起下发。
        '/v1': {
          target: env.VITE_KB_PROXY_TARGET || 'http://127.0.0.1:8001',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Accept-Encoding', 'identity')
            })
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['cache-control'] = 'no-cache, no-transform'
              proxyRes.headers['x-accel-buffering'] = 'no'
            })
          }
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 1200
    }
  }
})
