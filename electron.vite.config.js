import { defineConfig } from 'electron-vite';
import { resolve } from 'path';

export default defineConfig({
    main: {
        entry: 'src/main/main.js',
        build: {
            outDir: 'dist/main',
            rollupOptions: {
                output: {
                    entryFileNames: 'main.js'  // 强制输出为 main.js
                },
                external: ['electron']
            }
        }
    },
    preload: {
        entry: 'src/preload/preload.js',
        build: {
            outDir: 'dist/preload'
        }
    },
    renderer: {
        entry: {
            index: resolve(__dirname, 'src/renderer/index.html'),
            lock: resolve(__dirname, 'src/renderer/lock.html')
        },
        build: {
            outDir: 'dist/renderer'
        }
    }
});