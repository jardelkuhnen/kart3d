# LICENSES — KART LEGENDS 3D

Todos os ativos utilizados neste projeto devem possuir licença explicitamente auditada e registrada no manifesto `public/assets/manifest.json`.

## Licenças Autorizadas

- `Original-Project-License`: Ativos originais produzidos especificamente pelo pipeline de assets do projeto (`scripts/asset-pipeline/`).
- `CC0-1.0`: Domínio público / Creative Commons Zero.
- `MIT`: Software e recursos compatíveis sob licença MIT.
- `CC-BY-4.0`: Recursos com atribuição obrigatória listada abaixo caso adicionados.

## Registro Atual de Ativos

- **Personagens GLB (`public/assets/characters/`)**: `nilo.glb` (rig animado com 9 clipes GLTF) — Criado localmente via `scripts/asset-pipeline/character-builder.ts`. Licença: `Original-Project-License`.
- **Karts GLB (`public/assets/karts/`)**: `trilha_raposa.glb` (chassi multi-peça e 4 rodas independentes) — Criado localmente via `scripts/asset-pipeline/kart-builder.ts`. Licença: `Original-Project-License`.
- **Pistas GLB (`public/assets/tracks/`)**: `porto_das_lanternas.glb` (pista costeira completa com pórtico, farol, casas, barcos, mercado, ponte, túnel, rampas e atalho) — Criado localmente via `scripts/asset-pipeline/track-builder.ts`. Licença: `Original-Project-License`.
- **Props GLB (`public/assets/props/`)**: `start_gantry.glb`, `chevron_board.glb`, `boost_pad.glb` — Criados localmente via `@gltf-transform/core`. Licença: `Original-Project-License`.
- **Texturas e UI (`.png`)**: `asphalt_albedo.png`, `asphalt_roughness.png`, `curb_albedo.png`, `start_line_albedo.png`, `chevron_sign_albedo.png`, `portrait_nilo.png`, `icon_nilo.png` — Criados localmente via `scripts/asset-pipeline/texture-builder.ts`. Licença: `Original-Project-License`.
- **Áudio (`.ogg`)**: `ui_click.ogg`, `ui_confirm.ogg` — Sintetizados localmente via PCM + `ffmpeg` (`libopus`). Licença: `Original-Project-License`.

## Dependências de Runtime e Ferramentas

As bibliotecas Open Source instaladas via `package.json` mantêm suas respectivas licenças MIT/Apache-2.0 em `node_modules/`.
