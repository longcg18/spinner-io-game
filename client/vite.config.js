import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
  server: {
    port: 5500,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:7860',
        ws: true,
      },
    },
  },
});
