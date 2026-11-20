import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local `dev` / `build` / `preview` stay at `/` so the existing scripts and
 * Playwright (`http://127.0.0.1:4173/`) keep working.
 * GitHub Pages is a project site: `.github/workflows/pages.yml` sets
 * `BASE_PATH=/kart3d/` for the production build that gets deployed.
 */
function resolveViteBase(raw = process.env.BASE_PATH): string {
  const value = raw?.trim();
  if (!value || value === '/') return '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: resolveViteBase(),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.ogg', '**/*.mp3', '**/*.wav'],
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'three-core',
              test: /[\\/]node_modules[\\/]three[\\/]/,
              priority: 20,
            },
            {
              name: 'three-stdlib',
              test: /[\\/]node_modules[\\/]three-stdlib[\\/]/,
              priority: 18,
            },
            {
              name: 'r3f',
              test: /[\\/]node_modules[\\/]@react-three[\\/]/,
              priority: 15,
            },
            {
              name: 'react-vendor',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|zustand|howler)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
