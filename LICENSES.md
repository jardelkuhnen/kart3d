# LICENSES — KART LEGENDS 3D

Todos os ativos utilizados neste projeto devem possuir licença explicitamente auditada e registrada no manifesto `public/assets/manifest.json`.

## Licenças Autorizadas

- `Original-Project-License`: Ativos originais produzidos especificamente pelo pipeline de assets do projeto (`scripts/asset-pipeline/`).
- `CC0-1.0`: Domínio público / Creative Commons Zero.
- `MIT`: Software e recursos compatíveis sob licença MIT.
- `CC-BY-4.0`: Recursos com atribuição obrigatória listada abaixo caso adicionados.

## Registro Atual de Ativos

- **Personagens GLB (`public/assets/characters/`)**: `nilo.glb`, `boro.glb`, `lumi.glb`, `kora.glb`, `tiko.glb`, `mavi.glb`, `runi.glb` e `zera.glb` (todos com esqueleto articulado e 9 clipes GLTF) — Criados localmente via `scripts/asset-pipeline/character-builder.ts`. Licença: `Original-Project-License`.
- **Karts GLB (`public/assets/karts/`)**: `trilha_raposa.glb`, `engrenagem_turbo.glb`, `cometa_estelar.glb`, `raiz_veloz.glb`, `chave_mestra_gt.glb`, `brisa_corsaria.glb`, `escorpiao_dourado.glb` e `lamina_glacial.glb` (chassis estruturalmente distintos e 4 rodas independentes) — Criados localmente via `scripts/asset-pipeline/kart-builder.ts`. Licença: `Original-Project-License`.
- **Pistas GLB (`public/assets/tracks/`)**: `porto_das_lanternas.glb`, `bosque_de_cristal.glb`, `vale_dos_moinhos.glb` e `canion_solar.glb` (4 circuitos completos da Copa Aurora) — Criados localmente via `scripts/asset-pipeline/track-builder.ts`. Licença: `Original-Project-License`.
- **Itens & Props GLB (`public/assets/items/`, `public/assets/props/`)**: `item_box.glb`, `pulso_solar.glb`, `bolha_guardia.glb`, `nevoa_prisma.glb`, `faisca_rastreadora.glb`, `onda_de_vento.glb`, `cristal_de_salto.glb`, `start_gantry.glb`, `chevron_board.glb`, `boost_pad.glb` — Criados localmente via `scripts/asset-pipeline/item-builder.ts` e `@gltf-transform/core`. Licença: `Original-Project-License`.
- **Texturas e UI (`.png`)**: Texturas PBR de pista, 8 retratos de seleção (`portrait_*.png`), 8 ícones de HUD (`icon_*.png`) e os 6 ícones dos itens (`item_*.png`) — Criados localmente via `scripts/asset-pipeline/texture-builder.ts`. Licença: `Original-Project-License`.
- **Áudio Original (`.ogg`)**: Músicas (`menu_theme.ogg`, `race_aurora.ogg`, `victory_fanfare.ogg`, `defeat_theme.ogg`), ambiências de bioma (`ambience_coastal.ogg`, `ambience_forest.ogg`, `ambience_valley.ogg`, `ambience_canyon.ogg`) e 13 efeitos sonoros de corrida e interface — Sintetizados localmente via PCM + `ffmpeg` (`libopus`). Licença: `Original-Project-License`.

## Dependências de Runtime e Ferramentas

As bibliotecas Open Source instaladas via `package.json` mantêm suas respectivas licenças MIT/Apache-2.0 em `node_modules/`.
