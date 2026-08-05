import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const openAvatarTarget = process.env.VITE_OPENAVATAR_TARGET || 'http://127.0.0.1:8282';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/openavatar': {
        target: openAvatarTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/openavatar/, '') || '/',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];
          });
        },
      },
    },
  },
});
