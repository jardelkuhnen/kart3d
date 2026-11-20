# Arquitetura — KART LEGENDS 3D

## Visão Geral

O projeto é organizado com separação estrita entre núcleo de simulação, dados do jogo, renderização 3D, interface React e pipeline offline de assets.

### Convenção Espacial Padrão

- **Eixo vertical:** `+Y` para cima (chão de referência em `Y = 0`)
- **Direção frontal:** `-Z` para frente
- **Lateral direita:** `+X` para a direita
- **Escala:** `1 unidade = 1 metro`

## Diretórios Principais

- `public/assets/`: Recursos locais obrigatórios da build (`manifest.json`, `characters/`, `karts/`, `tracks/`, `props/`, `items/`, `textures/`, `audio/`).
- `src/app/`: Entrada da aplicação React e estado global (`store.ts`).
- `src/data/`: Catálogos completos tipados em PT-BR (`characters.ts`, `karts.ts`, `tracks.ts`, `items.ts`).
- `src/game/core/`: Tipos de domínio (`types.ts`), constantes e `FixedStepClock` em `60 Hz` (`constants.ts`) e carregador/validador de manifesto e descarte de memória (`assetLoader.ts`).
- `src/game/{physics,vehicles,characters,ai,racing,tracks,items,camera,vfx,audio,input,save}/`: Módulos dedicados por subsistema implementados ao longo dos slices 1 a 7.
- `src/scenes/`: Cenas React Three Fiber isoladas da camada de UI DOM.
- `src/components/{ui,hud}/`: Menus, telas e HUD de corrida.
- `scripts/asset-pipeline/`: Ferramentas de geração determinística de texturas PBR (`texture-builder.ts`), modelos GLB 2.0 com `@gltf-transform/core` (`glb-builder.ts`) e áudio PCM/Opus (`audio-builder.ts`).
- `scripts/validate-assets.ts`: Auditoria automática contra `public/assets/manifest.json`.
- `e2e/`: Testes automatizados ponta a ponta com Playwright.

## Simulação em Timestep Fixo

Toda física de corrida e calibração executa em passo fixo (`FIXED_TIMESTEP = 1 / 60` segundos) com acumulador limitado (`MAX_FRAME_DELTA = 0.1s`) via `FixedStepClock`, garantindo comportamento idêntico independente da taxa de atualização do monitor (30, 60, 120 ou 144 FPS).

## Roadmap por Vertical Slices

1. **Slice 0 (Concluído nesta entrega):** Arquitetura base, catálogos, pipeline GLB/PNG/OGG, validador real, cena de calibração WebGL + Rapier, Vitest + Playwright.
2. **Slice 1:** Núcleo jogável 1×1×1 (Nilo + Kart Trilha Raposa + Pista Porto das Lanternas + física arcade, drift 3 níveis, câmera dinâmica e checkpoints).
3. **Slice 2:** 7 adversários com IA física, 6 itens, HUD completo e sistema de áudio reativo.
4. **Slice 3:** 8 personagens originais animados + 8 karts distintos.
5. **Slice 4:** Copa Aurora completa (Pistas 2, 3 e 4).
6. **Slice 5:** Copa Eclipse completa (Pistas 5, 6, 7 e 8).
7. **Slice 6:** 14 telas, 4 modos, campeonato, pódio 3D e persistência versionada.
8. **Slice 7:** VFX avançado, otimização de FPS/memória, QA completo e build final.
