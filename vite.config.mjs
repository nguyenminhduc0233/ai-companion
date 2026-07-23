import { defineConfig } from 'vite';

// Base is relative ('./') so the built bundle works when loaded from
// the file system (Electron loadFile) and from the Android WebView (Capacitor).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@pixiv/three-vrm'],
          docs: ['pdfjs-dist', 'mammoth'],
          ocr: ['tesseract.js']
        }
      }
    }
  },
  worker: {
    format: 'es'
  },
  server: {
    port: 5173,
    host: true
  }
});
