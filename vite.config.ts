import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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

/**
 * `@dimforge/rapier3d-compat` initializes with
 * `new URL("rapier_wasm3d_bg.wasm", import.meta.url)`. The path has no `./`,
 * so Vite never emits the wasm and production 404s it (at `/` and under
 * `/kart3d/`). Importing it with `?url` emits a hashed file prefixed by `base`.
 */
function rapierWasmUrlPlugin(): Plugin {
  return {
    name: 'rapier-wasm-url',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@dimforge/rapier3d-compat') || !code.includes('rapier_wasm3d_bg.wasm')) {
        return null;
      }
      if (code.includes('__VITE_RAPIER_WASM_URL__')) return null;
      const replaced = code.replace(
        /new URL\(\s*(['"`])rapier_wasm3d_bg\.wasm\1\s*,\s*[^)]+\)/g,
        '__VITE_RAPIER_WASM_URL__',
      );
      if (replaced === code) return null;
      return `import __VITE_RAPIER_WASM_URL__ from "./rapier_wasm3d_bg.wasm?url";\n${replaced}`;
    },
  };
}

export default defineConfig({
  base: resolveViteBase(),
  plugins: [react(), rapierWasmUrlPlugin()],
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
