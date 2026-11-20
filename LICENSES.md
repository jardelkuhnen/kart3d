# LICENSES — KART LEGENDS 3D

Todos os ativos utilizados neste projeto possuem licença explicitamente auditada e registrada no manifesto `public/assets/manifest.json` (total atual: **114 recursos verificados**).

## Licenças Autorizadas

- `Original-Project-License`: Ativos originais produzidos especificamente pelo pipeline de assets do projeto (`scripts/asset-pipeline/`).
- `CC0-1.0`: Domínio público / Creative Commons Zero.
- `MIT`: Software e recursos compatíveis sob licença MIT.
- `CC-BY-4.0`: Recursos com atribuição obrigatória listada abaixo caso adicionados.

## Registro Completo dos 114 Ativos Locais (`public/assets/`)

- **Personagens GLB (`public/assets/characters/` — 8 ativos)**: `nilo.glb`, `boro.glb`, `lumi.glb`, `kora.glb`, `tiko.glb`, `mavi.glb`, `runi.glb` e `zera.glb` (esqueleto articulado e 9 clipes de animação GLTF cada) — Criados localmente via `scripts/asset-pipeline/character-builder.ts`. Licença: `Original-Project-License`.
- **Karts GLB (`public/assets/karts/` — 8 ativos)**: `trilha_raposa.glb`, `engrenagem_turbo.glb`, `cometa_estelar.glb`, `raiz_veloz.glb`, `chave_mestra_gt.glb`, `brisa_corsaria.glb`, `escorpiao_dourado.glb` e `lamina_glacial.glb` (chassis estruturalmente distintos e 4 rodas independentes) — Criados localmente via `scripts/asset-pipeline/kart-builder.ts`. Licença: `Original-Project-License`.
- **Pistas GLB (`public/assets/tracks/` — 8 ativos)**: `porto_das_lanternas.glb`, `bosque_de_cristal.glb`, `vale_dos_moinhos.glb`, `canion_solar.glb`, `cidade_neon.glb`, `pico_boreal.glb`, `jardim_celeste.glb` e `fortaleza_tempestade.glb` — Criadas localmente via `scripts/asset-pipeline/track-builder.ts`. Licença: `Original-Project-License`.
- **Itens & Props GLB (`public/assets/items/` e `public/assets/props/` — 10 ativos)**: `item_box.glb`, `pulso_solar.glb`, `bolha_guardia.glb`, `nevoa_prisma.glb`, `faisca_rastreadora.glb`, `onda_de_vento.glb`, `cristal_de_salto.glb`, `start_gantry.glb`, `chevron_board.glb`, `boost_pad.glb` — Criados localmente via `scripts/asset-pipeline/item-builder.ts` e `@gltf-transform/core`. Licença: `Original-Project-License`.
- **Texturas PBR, UI & VFX Atlas (`.png` — 28 ativos)**: 5 texturas em `public/assets/textures/` (`asphalt_albedo.png`, `asphalt_roughness.png`, `curb_albedo.png`, `start_line_albedo.png`, `chevron_sign_albedo.png`), 8 retratos de seleção (`portrait_*.png`), 8 ícones de HUD (`icon_*.png`), 6 ícones dos itens (`item_*.png`) e o atlas de partículas 2×2 `public/assets/vfx/particles_atlas.png` (`vfx-particles-atlas`) — Criados localmente via `scripts/asset-pipeline/texture-builder.ts` (`pngjs`) com texturas adicionais de bioma embutidas diretamente nos `.glb` das pistas. Licença: `Original-Project-License`.
- **Áudio Original (`.ogg` + fallback `.mp3` — 52 ativos: 26 `.ogg` + 26 `.mp3`)**: 5 músicas (`menu_theme`, `race_aurora`, `race_eclipse`, `victory_fanfare`, `defeat_theme`), 8 ambiências de bioma (`ambience_coastal`, `ambience_forest`, `ambience_valley`, `ambience_canyon`, `ambience_neon`, `ambience_boreal`, `ambience_sky`, `ambience_storm`) e 13 efeitos sonoros de corrida e interface — Sintetizados localmente via PCM em duplo formato com `ffmpeg` (`libopus` para `.ogg` e `libmp3lame` para `.mp3` compatível com iOS Safari/WebKit). Licença: `Original-Project-License`.

## Dependências de Runtime e Ferramentas

As bibliotecas Open Source instaladas via `package.json` mantêm suas respectivas licenças originais (MIT / Apache-2.0) em `node_modules/`. Não há ativos de terceiros protegidos por direitos autorais nem chamadas externas de rede durante o jogo.
