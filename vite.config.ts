import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.mp3', '**/*.wav'],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@react-three/rapier') || id.includes('@dimforge/rapier')) {
            return 'rapier';
          }
          if (id.includes('node_modules/@react-three/')) return 'r3f';
          return undefined;
        },
      },
    },
  },
});
