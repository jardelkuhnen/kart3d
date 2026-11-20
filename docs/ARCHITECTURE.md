# Arquitetura — KART LEGENDS 3D

## Visão Geral

**KART LEGENDS 3D** é construído com separação modular estrita entre simulação determinística de corrida em TypeScript, catálogos de dados originais, renderização 3D WebGL via **Three.js + React Three Fiber + Rapier**, shaders/VFX em pool com instancing, áudio híbrido (**Howler.js + Web Audio API**), UI reativa com **Zustand** e pipeline offline determinístico de ativos.

### Convenção Espacial Padrão

- **Eixo vertical:** `+Y` para cima (chão de referência em `Y = 0`)
- **Direção frontal:** `-Z` para frente
- **Lateral direita:** `+X` para a direita
- **Escala:** `1 unidade = 1 metro`

---

## Camadas e Módulos (`src/` & `scripts/`)

### 1. Aplicação, Estado e Persistência
- `src/main.tsx` e `src/app/App.tsx`: Orquestração do ciclo de vida do jogo, seleção de modos/cenas, áudio global e transições entre as 14 telas em PT-BR.
- `src/app/store.ts`: Estado global Zustand para navegação, seleções de piloto/kart/copa/pista/dificuldade/modo, campeonato em andamento, configurações, remapeamento de entrada e salvamento.
- `src/game/save/saveManager.ts`: Persistência versionada (`kart-legends-3d:save:v1` em `localStorage`) com detecção e recuperação automática contra JSON corrompido ou versões incompatíveis, melhores tempos por pista, troféus e regras de desbloqueio.

### 2. Catálogos de Dados Originais (`src/data/`)
- `characters.ts`: 8 pilotos originais (*Nilo*, *Boro*, *Lumi*, *Kora*, *Tiko*, *Mavi*, *Runi*, *Zera*) com bônus de atributos, perfis visuais e regras de desbloqueio.
- `karts.ts`: 8 karts distintos (*Trilha Raposa*, *Engrenagem Turbo*, *Cometa Estelar*, *Raiz Veloz*, *Chave-Mestra GT*, *Brisa Corsária*, *Escorpião Dourado*, *Lâmina Glacial*).
- `tracks.ts`: 8 pistas em 2 copas (**Copa Aurora** e **Copa Eclipse**), com tema, superfície, elevação, descrição e metadados de exibição.
- `items.ts`: 6 itens táticos (*Pulso Solar*, *Bolha Guardiã*, *Névoa Prisma*, *Faísca Rastreadora*, *Onda de Vento*, *Cristal de Salto*).

### 3. Simulação em Timestep Fixo, Física, IA & Itens (`src/game/`)
- `core/constants.ts`, `core/types.ts`, `core/assetLoader.ts`: `FixedStepClock` em `60 Hz` (`FIXED_TIMESTEP = 1 / 60`, `MAX_FRAME_DELTA = 0.1`), validação do schema `manifest.json` e `disposeObject3D`.
- `physics/kartController.ts`: Física arcade com resposta por superfície (`asphalt`, `dirt`, `grass`, `sand`, `ice`), drift em 3 níveis com miniturbo ao soltar, rampas, boost pads e colisão massa-ponderada.
- `ai/aiController.ts`: 7 adversários dirigidos pela mesma simulação física (sem trapaça ou teleporte), com traçado de spline, atalhos, desvio de obstáculos móveis e perfis *Fácil*, *Normal* e *Difícil*.
- `items/itemSystem.ts`: Roleta ponderada por posição, caixas reaparecendo no circuito, projéteis, escudos e ativações pela IA.
- `racing/raceManager.ts`, `racing/raceSimulation.ts`, `racing/championshipManager.ts`: Laps com validação estrita anti-corte por sequência de checkpoints, detecção de contramão, ordenação `1º–8º`, modo *Corrida Rápida*, *Campeonato* (4 etapas + troféus Ouro/Prata/Bronze), *Contrarrelógio* e *Treino Livre*.
- `tracks/`: Geometria e avaliação de spline em `trackGeometry.ts`, registro central `registry.ts` (`getTrackLayout`, `getTrackVisualTheme`, `FALLBACK_TRACK_GLB_PATHS`) e layouts individuais (`portoDasLanternas.ts`, `bosqueDeCristal.ts`, `valeDosMoinhos.ts`, `canionSolar.ts`, `cidadeNeon.ts`, `picoBoreal.ts`, `jardimCeleste.ts`, `fortalezaTempestade.ts`).
- `input/inputManager.ts`: Leitura unificada de teclado (com remapeamento configurável por ação), foco de UI e Gamepad API com sensibilidade e zona morta ajustáveis.

### 4. Renderização 3D, Shaders, VFX & Áudio (`src/scenes/`, `src/shaders/`, `src/game/vfx/`, `src/game/audio/`)
- `scenes/RaceScene.tsx`: Palco 3D React Three Fiber isolado da camada DOM, alternando entre fundo de menu (`menu-bg`), Garagem Showcase (`showcase`), Pódio 3D (`podium`) e pista de corrida (`race`) com `@react-three/rapier` e carregamento sob demanda dos GLBs da pista selecionada.
- `scenes/ShowcaseStages.tsx`: `GarageShowcaseStage` (pedestal giratório em tempo real para seleção de pilotos/karts) e `PodiumCeremonyStage` (pódio Top 3 animado com chuva de confetes instanciada).
- `vehicles/KartEntity.tsx`, `vehicles/RacerMeshInstance.tsx`, `characters/CharacterRig.tsx`, `camera/RaceCamera.tsx`: Veículos e pilotos com reprodução dos 9 clipes GLTF (`idle`, `drive`, `turnLeft`, `turnRight`, `drift`, `hit`, `victory`, `defeat`, `podium`) e câmera dinâmica com antecipação de curva e sensação de turbo.
- `game/vfx/vfxConfig.ts` & `game/vfx/VfxSystem.tsx`: Presets de qualidade `low`, `medium` e `high` (`QUALITY_PRESETS` controlando DPR, antialias, sombras, shadowMapSize, capacidade de partículas e linhas de velocidade), sistema `InstancedMesh` em pool fixo sem alocações por quadro (poeira por superfície, faíscas de drift 3 níveis, chamas de turbo, rajadas de impacto/boost e clima por bioma nas 8 pistas).
- `shaders/particleAtlasShader.ts` & `shaders/speedLinesShader.ts`: Shader customizado de recorte do atlas 2×2 por instância (`aCellOffset`, `aColor`) e overlay fullscreen aditivo de linhas de velocidade radial reativo à velocidade e turbo.
- `game/audio/audioEngine.ts`: `GameAudioEngine` gerenciando trilhas musicais, 8 ambiências e 13 SFX `.ogg` em 3 canais independentes via Howler.js, além de sintetizador Web Audio API contínuo para motor e drift com desbloqueio seguro de autoplay.

### 5. UI Completa (14 Telas) & HUD (`src/components/`)
- `components/ui/`: `LoadingAndMenuScreens.tsx`, `GarageScreens.tsx` e `OutcomeAndMetaScreens.tsx` implementando todas as 14 telas em PT-BR (Carregamento, Menu Principal, Seleção de Modo, Seleção de Personagem, Seleção de Kart, Seleção de Copa, Seleção de Pista, Dificuldade/Largada, Corrida, Pausa, Configurações, Resultados, Pódio 3D e Progressão/Troféus).
- `components/hud/`: `RaceHud.tsx` e `Minimap.tsx` exibindo posição `1º–8º`, minimapa em tempo real com os 8 competidores, slot de item, alertas, velocímetro, barra de drift 3 níveis e placar final.

### 6. Pipeline Offline de Ativos e Validação (`scripts/`)
- `scripts/build-assets.ts` e `scripts/asset-pipeline/` (`character-builder.ts`, `kart-builder.ts`, `track-builder.ts`, `item-builder.ts`, `texture-builder.ts`, `glb-builder.ts`, `audio-builder.ts`): Geração determinística de **88 ativos locais** em `public/assets/` (`manifest.json` + `.glb`, `.png`, `.ogg`), zero dependência de rede em runtime.
- `scripts/validate-assets.ts`: Auditoria rígida contra `public/assets/manifest.json` (assinaturas binárias GLB/PNG/OGG, nós obrigatórios, 9 clipes GLTF por personagem, pás animadas de moinho, licenças permitidas e ausência de arquivos órfãos).

---

## Histórico dos Slices Entregues (0 a 7)

1. **Slice 0:** Fundação, catálogos base, pipeline GLB/PNG/OGG, validador real, cena de calibração WebGL + Rapier, Vitest + Playwright.
2. **Slice 1:** Núcleo jogável 1×1×1 (*Nilo* + *Trilha Raposa* + *Porto das Lanternas*), física 60 Hz, drift 3 níveis, checkpoints e câmera dinâmica.
3. **Slice 2:** 7 adversários com IA física, 6 itens balanceados, HUD completo com minimapa e motor de áudio Howler + Web Audio.
4. **Slice 3:** Todos os 8 personagens animados (9 animações GLTF + retratos/ícones) e todos os 8 karts estruturalmente distintos na Garagem.
5. **Slice 4:** Copa Aurora completa (*Porto das Lanternas*, *Bosque de Cristal*, *Vale dos Moinhos*, *Cânion Solar*) com marcos 3D e ambiências próprias.
6. **Slice 5:** Copa Eclipse completa (*Cidade Neon*, *Pico Boreal* com gelo, *Jardim Celeste*, *Fortaleza Tempestade* com raios e obstáculos móveis).
7. **Slice 6:** Todas as 14 telas em PT-BR, 4 modos, Campeonato de 4 etapas, Pódio 3D, Garagem Showcase giratória, remapeamento de teclas e save versionado `v1` com recuperação de corrupção.
8. **Slice 7:** VFX em pool `InstancedMesh` + atlas 2×2 com `particleAtlasShader.ts`, `speedLinesShader.ts`, presets `low`/`medium`/`high`, benchmark real de FPS no Chrome WebGL, capturas reais de tela e documentação final.
