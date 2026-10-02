import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: { minify: 'esbuild' },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: { minify: 'esbuild' },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    build: {
      // electron-vite ne minifikuje renderer podrazumevano.
      minify: 'esbuild',
      // React u zasebnom chunku — ne menja se izmedju verzija aplikacije.
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-dom/client']
          }
        }
      }
    },
    plugins: [react()]
  }
})
