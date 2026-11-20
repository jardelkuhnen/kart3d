# LICENSES — KART LEGENDS 3D

Todos os ativos utilizados neste projeto devem possuir licença explicitamente auditada e registrada no manifesto `public/assets/manifest.json`.

## Licenças Autorizadas

- `Original-Project-License`: Ativos originais produzidos especificamente pelo pipeline de assets do projeto (`scripts/asset-pipeline/`).
- `CC0-1.0`: Domínio público / Creative Commons Zero.
- `MIT`: Software e recursos compatíveis sob licença MIT.
- `CC-BY-4.0`: Recursos com atribuição obrigatória listada abaixo caso adicionados.

## Registro Atual de Ativos (Slice 0)

- **Modelos 3D (`.glb`)**: `start_gantry.glb`, `chevron_board.glb`, `boost_pad.glb` — Criados localmente via `@gltf-transform/core` (`scripts/build-assets.ts`). Licença: `Original-Project-License`.
- **Texturas PBR (`.png`)**: `asphalt_albedo.png`, `asphalt_roughness.png`, `curb_albedo.png`, `start_line_albedo.png`, `chevron_sign_albedo.png` — Criadas localmente via `scripts/asset-pipeline/texture-builder.ts`. Licença: `Original-Project-License`.
- **Áudio (`.ogg`)**: `ui_click.ogg`, `ui_confirm.ogg` — Sintetizados localmente via PCM + `ffmpeg` (`libopus`). Licença: `Original-Project-License`.

## Dependências de Runtime e Ferramentas

As bibliotecas Open Source instaladas via `package.json` (React, Three.js, React Three Fiber, Drei, Rapier, Postprocessing, Zustand, Howler.js, Vite, Vitest, Playwright, ESLint, TypeScript, glTF-Transform, pngjs) mantêm suas respectivas licenças MIT/Apache-2.0 nos arquivos de `node_modules/`.
