import { defineConfig } from 'electron-vite'
import { resolve } from 'path'

export default defineConfig({
    main: {
        build: {
            outDir: 'dist/main',
            minify: 'esbuild',
            rollupOptions: {
                external: ['electron'],
                output: { entryFileNames: 'main.js' }
            }
        }
    },
    preload: {
        build: { outDir: 'dist/preload', minify: 'esbuild' }
    },
    renderer: {
        entry: {
            index: resolve(__dirname, 'src/renderer/index.html'),
            lock: resolve(__dirname, 'src/renderer/lock.html')
        },
        build: {
            outDir: 'dist/renderer',
            minify: 'esbuild',
            cssCodeSplit: true
        }
    }
})