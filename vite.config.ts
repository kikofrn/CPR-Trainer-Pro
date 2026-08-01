import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Use the standard public directory so UI assets are bundled correctly
    publicDir: 'public',
    build: {
      target: 'esnext',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          splash: path.resolve(__dirname, 'splash.html'),
        },
        output: {
          manualChunks: {
            'vendor-pdf': ['react-pdf', 'pdfjs-dist'],
            'vendor-flipbook': ['react-pageflip'],
          }
        }
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
