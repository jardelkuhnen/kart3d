# LICENSES — KART LEGENDS 3D

Todos os ativos utilizados neste projeto possuem licença explicitamente auditada e registrada no manifesto `public/assets/manifest.json` (total atual: **114 recursos verificados**).

## Licenças Autorizadas

- `Original-Project-License`: Ativos originais produzidos especificamente pelo pipeline Blender 4.5.16 LTS (`scripts/blender/`) e pelo pipeline local de texturas/áudio (`scripts/asset-pipeline/`).
- `CC0-1.0`: Domínio público / Creative Commons Zero (caso ativos externos CC0 sejam adicionados).
- `MIT`: Software e recursos compatíveis sob licença MIT.
- `CC-BY-4.0`: Recursos com atribuição obrigatória listada abaixo caso adicionados.

## Registro Completo dos 114 Ativos Locais (`public/assets/`)

- **Personagens GLB (`public/assets/characters/` — 8 ativos)**: `nilo.glb`, `boro.glb`, `lumi.glb`, `kora.glb`, `tiko.glb`, `mavi.glb`, `runi.glb` e `zera.glb` (malhas esculpidas com materiais PBR/clearcoat, hierarquia articulada completa e 9 clipes de animação GLTF cada: `idle`, `drive`, `turnLeft`, `turnRight`, `drift`, `hit`, `victory`, `defeat`, `podium`) — Gerados via **Blender 4.5.16 LTS** (`scripts/blender/build_characters.py`). Autor: `Kart Legends 3D — Blender 4.5 Pipeline`. Licença: `Original-Project-License`.
- **Karts GLB (`public/assets/karts/` — 8 ativos)**: `trilha_raposa.glb`, `engrenagem_turbo.glb`, `cometa_estelar.glb`, `raiz_veloz.glb`, `chave_mestra_gt.glb`, `brisa_corsaria.glb`, `escorpiao_dourado.glb` e `lamina_glacial.glb` (chassis aerodinâmicos loftados distintos, suspensão A-arm, bancos esportivos, motores detalhados, escapes duplos e 4 rodas independentes com aros raiados e pneus esculpidos) — Gerados via **Blender 4.5.16 LTS** (`scripts/blender/build_karts.py`). Autor: `Kart Legends 3D — Blender 4.5 Pipeline`. Licença: `Original-Project-License`.
- **Pistas GLB (`public/assets/tracks/` — 8 ativos)**: `porto_das_lanternas.glb`, `bosque_de_cristal.glb`, `vale_dos_moinhos.glb`, `canion_solar.glb`, `cidade_neon.glb`, `pico_boreal.glb`, `jardim_celeste.glb` e `fortaleza_tempestade.glb` (traçados fiéis à física, zebras 3D chanfradas, muros com mapeamento UV métrico e capeamento, pórticos, rampas, boost pads e cenários instanciados esculpidos por bioma) — Geradas via **Blender 4.5.16 LTS** (`scripts/blender/build_tracks.py`). Autor: `Kart Legends 3D — Blender 4.5 Pipeline`. Licença: `Original-Project-License`.
- **Itens & Props GLB (`public/assets/items/` e `public/assets/props/` — 10 ativos)**: `item_box.glb`, `pulso_solar.glb`, `bolha_guardia.glb`, `nevoa_prisma.glb`, `faisca_rastreadora.glb`, `onda_de_vento.glb`, `cristal_de_salto.glb`, `start_gantry.glb`, `chevron_board.glb`, `boost_pad.glb` — Gerados via **Blender 4.5.16 LTS** (`scripts/blender/build_items_and_props.py`). Autor: `Kart Legends 3D — Blender 4.5 Pipeline`. Licença: `Original-Project-License`.
- **Retratos e Ícones de HUD (`public/assets/ui/` — 22 ativos)**: 8 retratos 256×256 (`portrait_*.png`), 8 ícones de HUD 128×128 (`icon_*.png`) e 6 ícones de itens 128×128 (`item_*.png`) — Renderizados diretamente dos modelos 3D com **Blender 4.5.16 LTS Cycles** (`scripts/blender/build_characters.py` e `scripts/blender/build_items_and_props.py`). Autor: `Kart Legends 3D — Blender 4.5 Pipeline`. Licença: `Original-Project-License`.
- **Texturas PBR & VFX Atlas (`public/assets/textures/` e `public/assets/vfx/` — 6 ativos)**: 5 texturas em `public/assets/textures/` (`asphalt_albedo.png`, `asphalt_roughness.png`, `curb_albedo.png`, `start_line_albedo.png`, `chevron_sign_albedo.png`) e atlas de partículas 2×2 `public/assets/vfx/particles_atlas.png` (`vfx-particles-atlas`) — Gerados localmente via `scripts/asset-pipeline/texture-builder.ts` (`pngjs`). Licença: `Original-Project-License`.
- **Áudio Original (`.ogg` + fallback `.mp3` — 52 ativos: 26 `.ogg` + 26 `.mp3`)**: 5 músicas (`menu_theme`, `race_aurora`, `race_eclipse`, `victory_fanfare`, `defeat_theme`), 8 ambiências de bioma (`ambience_coastal`, `ambience_forest`, `ambience_valley`, `ambience_canyon`, `ambience_neon`, `ambience_boreal`, `ambience_sky`, `ambience_storm`) e 13 efeitos sonoros de corrida e interface — Sintetizados localmente via PCM em duplo formato com `ffmpeg` (`libopus` para `.ogg` e `libmp3lame` para `.mp3` compatível com iOS Safari/WebKit). Licença: `Original-Project-License`.

## Pacotes CC0 de Terceiros

Nenhum ativo binário externo de terceiros foi importado nesta remodelagem; todos os modelos 3D, animações e retratos/ícones renderizados foram produzidos 100% de forma reprodutível pelos scripts Python de Blender em `scripts/blender/` sob `Original-Project-License`, preservando unidade artística, escala exata e compatibilidade total com os pontos de encaixe do código.

## Dependências de Runtime e Ferramentas

As bibliotecas Open Source instaladas via `package.json` mantêm suas respectivas licenças originais (MIT / Apache-2.0) em `node_modules/`. O Blender 4.5.16 LTS (GNU GPLv3) é utilizado apenas como ferramenta de autoria em tempo de build; os arquivos `.glb` e `.png` gerados são ativos originais do projeto. Não há chamadas externas de rede durante o jogo.
