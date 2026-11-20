# QA REPORT — KART LEGENDS 3D

**Status do Projeto:** Todos os Slices 0 a 7 foram implementados, integrados e verificados com suíte automatizada verde (`validate:assets`, `typecheck`, `lint`, `Vitest`, `vite build` e `Playwright WebGL E2E`).
**Nota de Transparência (§27 — Ferramentas Externas):** Conforme registrado em *Limitações Conhecidas* abaixo, `blender` CLI não estava disponível neste host macOS (todos os modelos 3D, esqueletos, clipes GLTF e cenários foram gerados localmente via `@gltf-transform/core` + `pngjs` e áudios via `ffmpeg 8.1.1`), portanto seguimos estritamente a regra de transparência do documento mestre ao reportar o ambiente exato utilizado.

---

## Histórico Consolidado de Verificações por Slice

### Slice 0 — Fundação, Arquitetura e Pipeline de Assets
- `npm run assets:build`: PASS (10 ativos iniciais)
- `npm run validate:assets`: PASS (10 ativos, 0 erros, 0 órfãos)
- `npm run typecheck` / `npm run lint`: PASS (0 erros)
- `npm run test`: PASS (3 arquivos, 10 testes)
- `npm run build` / `npm run test:e2e`: PASS (`dist/` gerado; 1/1 aprovado)

### Slice 1 — Núcleo Jogável 1×1×1
- `npm run assets:build` / `validate:assets`: PASS (15 ativos)
- `npm run test`: PASS (6 arquivos, 21 testes)
- `npm run test:e2e`: PASS (2/2 aprovados)

### Slice 2 — Corrida Completa (7 Adversários IA, 6 Itens, HUD Completo & Áudio)
- `npm run assets:build` / `validate:assets`: PASS (44 ativos verificados)
- `npm run typecheck` / `npm run lint`: PASS (0 erros)
- `npm run test`: PASS (9 arquivos, 29 testes)
- `npm run build`: PASS (594 módulos em `1.00 s`)
- `npm run test:e2e`: PASS (2/2 aprovados)

### Slice 3 — 8 Personagens Animados e 8 Karts Estruturalmente Distintos
- `npm run assets:build` / `validate:assets`: PASS (72 ativos verificados)
- `npm run typecheck` / `npm run lint`: PASS (0 erros)
- `npm run test`: PASS (10 arquivos, 32 testes em `2.82 s`)
- `npm run build`: PASS (594 módulos em `753 ms`)
- `npm run test:e2e`: PASS (2/2 aprovados em `14.2 s`)

### Slice 4 — Copa Aurora Completa (*Bosque de Cristal*, *Vale dos Moinhos*, *Cânion Solar*)
- `npm run assets:build` / `validate:assets`: PASS (78 ativos verificados)
- `npm run typecheck` / `npm run lint`: PASS (0 erros)
- `npm run test`: PASS (11 arquivos, 35 testes em `2.79 s`)
- `npm run build`: PASS (598 módulos em `732 ms`)
- `npm run test:e2e`: PASS (3/3 aprovados em `23.4 s`)

### Slice 5 — Copa Eclipse Completa (*Cidade Neon*, *Pico Boreal*, *Jardim Celeste*, *Fortaleza Tempestade*)
- `npm run assets:build` / `validate:assets`: PASS (87 ativos verificados)
- `npm run typecheck` / `npm run lint`: PASS (0 erros)
- `npm run test`: PASS (12 arquivos, 39 testes em `3.56 s`)
- `npm run build`: PASS (602 módulos em `791 ms`)
- `npm run test:e2e`: PASS (4/4 aprovados em `29.2 s`)

### Slice 6 — 14 Telas, 4 Modos, Campeonato, Pódio 3D, Progressão e Save
- `npm run assets:build` / `validate:assets`: PASS (87 ativos verificados)
- `npm run typecheck` / `npm run lint`: PASS (0 erros)
- `npm run test`: PASS (13 arquivos, 42 testes em `3.44 s`)
- `npm run build`: PASS (608 módulos em `803 ms`)
- `npm run test:e2e`: PASS (5/5 aprovados em `29.5 s` com 2 workers)

---

## Slice 7 — VFX em Pool, Shaders Customizados, Qualidade, Benchmark Real e Entrega Final

### Verificações Executadas

| Comando | Resultado | Observações Diretamente Observadas |
| :--- | :--- | :--- |
| `npm run assets:build` | PASS | **88 recursos gerados** em `public/assets/` (incluindo `public/assets/vfx/particles_atlas.png` 2×2 RGBA e entrada `vfx-particles-atlas`) |
| `npm run validate:assets` | PASS | **88 ativos verificados**, 0 erros, 0 arquivos órfãos |
| `npm run typecheck` | PASS | `tsc --noEmit` (`strict`) com 0 erros |
| `npm run lint` | PASS | `eslint .` com 0 erros e 0 avisos |
| `npm run test` | PASS | Vitest `5.1.1`: **14 arquivos de teste, 46 testes aprovados** (0 falhas, 0 pulados; `3.59 s` na reexecução mais recente) |
| `npm run build` | PASS | Vite `8.3.8`: **612 módulos transformados** (`813 ms`; `dist/index.html` `1.03 kB`, `index.css` `17.27 kB`, `rolldown-runtime` `0.72 kB`, `index` `412.33 kB`, `r3f` `1,058.89 kB`, `rapier` `2,260.11 kB`) |
| `npm run test:e2e` | PASS | Playwright (Chrome + ANGLE Metal GPU, `1280×720`, `2 workers`): **7/7 testes aprovados em `42.6 s`–`42.8 s`** (`boot`, `menus-progression`, `performance-vfx #1 e #2`, `race-core`, `tracks-aurora`, `tracks-eclipse`), zero erros de página/console/HTTP |

### Escopo Entregue no Slice 7
- **Atlas de Partículas 2×2 & Shader de Recorte por Instância (`texture-builder.ts`, `src/shaders/particleAtlasShader.ts`):** quadrantes distintos para fumaça/poeira suave, faísca estrela de 4 pontas, floco diamante de clima/gelo e anel de choque, selecionados por partícula via atributos instanciados `aCellOffset` e `aColor`.
- **Shader de Linhas de Velocidade (`src/shaders/speedLinesShader.ts`):** material fullscreen aditivo em GLSL nas bordas da tela proporcional à velocidade e ao turbo ativo.
- **VFX em Pool Zero-Alocação (`src/game/vfx/VfxSystem.tsx`, `src/game/vfx/vfxConfig.ts`):** `InstancedMesh` de capacidade fixa com buffers tipados emitindo poeira/terra/grama/areia/gelo por superfície, faíscas de drift 3 níveis, chamas de miniturbo/turbo, bursts de colisão/boost e clima dedicado para todas as 8 pistas.
- **Presets de Qualidade (`QUALITY_PRESETS` em `RaceScene.tsx` & Configurações):** perfis `low` (`maxParticles: 64`, `shadowMapSize: 256`, sombras/antialias/speedLines desativados, `dpr [1, 1]`), `medium` (`140`, `512`, sombras/speedLines ativos, `dpr [1, 1.25]`) e `high` (`240`, `1024`, sombras/antialias/speedLines ativos, `dpr [1, 1.5]`).

### Medição Real de Desempenho em Navegador (`e2e/performance-vfx.spec.ts`)
Medições reais obtidas em corrida ativa de 8 competidores em *Porto das Lanternas* com aceleração + drift + VFX ligados no Playwright (Chrome + Metal GPU, `1280×720`):
- **Execução #1 (pós-correção do shader de partículas):** `110` quadros em `2017 ms` · **FPS médio:** `54.1 FPS` · **FPS mínimo:** `29.9 FPS` · **P95:** `33.3 ms` · **Heap JS:** `75.5 MB`.
- **Execução #2 (validação pré-commit):** `106` quadros em `2000 ms` · **FPS médio:** `52.5 FPS` · **FPS mínimo:** `15.0 FPS` · **P95:** `33.3 ms` · **Heap JS:** `64.8 MB`.
- **Evidências visuais reais geradas e inspecionadas:** `docs/screenshots/main_menu.png`, `docs/screenshots/garage_showcase.png`, `docs/screenshots/race_porto.png` e `docs/screenshots/race_fortaleza.png`.

---

## Matriz de Rastreabilidade dos 20 Tópicos de Teste (§23)

| # | Tópico Obrigatório (§23) | Cobertura Automatizada Verificada |
| :--- | :--- | :--- |
| 1 | Inicialização | `e2e/boot.spec.ts`, `src/tests/core.test.ts` |
| 2 | Carregamento de assets | `npm run validate:assets`, `src/tests/manifest.test.ts`, `src/tests/vfx-quality.test.ts` |
| 3 | Seleção de personagem | `e2e/race-core.spec.ts`, `e2e/performance-vfx.spec.ts`, `src/tests/catalog.test.ts`, `src/tests/garage.test.ts` |
| 4 | Seleção de kart | `e2e/race-core.spec.ts`, `src/tests/catalog.test.ts`, `src/tests/garage.test.ts` |
| 5 | Seleção de pista | `e2e/tracks-aurora.spec.ts`, `e2e/tracks-eclipse.spec.ts`, `src/tests/tracks-aurora.test.ts`, `src/tests/tracks-eclipse.test.ts` |
| 6 | Controles | `src/tests/input.test.ts`, `e2e/menus-progression.spec.ts` |
| 7 | Aceleração | `src/tests/physics.test.ts`, `e2e/race-core.spec.ts`, `e2e/performance-vfx.spec.ts` |
| 8 | Frenagem | `src/tests/physics.test.ts` |
| 9 | Drift | `src/tests/physics.test.ts`, `e2e/race-core.spec.ts`, `e2e/performance-vfx.spec.ts` |
| 10 | Turbo | `src/tests/physics.test.ts`, `src/tests/items.test.ts`, `src/tests/vfx-quality.test.ts` |
| 11 | Colisões | `src/tests/physics.test.ts`, `src/tests/ai-standings.test.ts`, `src/tests/tracks-eclipse.test.ts` |
| 12 | Checkpoints | `src/tests/racing.test.ts`, `src/tests/tracks-aurora.test.ts`, `src/tests/tracks-eclipse.test.ts` |
| 13 | Voltas | `src/tests/racing.test.ts`, `src/tests/save-championship.test.ts` |
| 14 | Classificação | `src/tests/ai-standings.test.ts`, `src/tests/save-championship.test.ts`, `e2e/race-core.spec.ts` |
| 15 | Itens | `src/tests/items.test.ts`, `e2e/race-core.spec.ts`, `e2e/menus-progression.spec.ts` |
| 16 | Inteligência artificial | `src/tests/ai-standings.test.ts`, `src/tests/tracks-aurora.test.ts`, `src/tests/tracks-eclipse.test.ts` |
| 17 | Pausa | `e2e/race-core.spec.ts`, `e2e/menus-progression.spec.ts` |
| 18 | Resultados | `src/tests/racing.test.ts`, `src/tests/ai-standings.test.ts`, `src/tests/save-championship.test.ts` |
| 19 | Salvamento | `src/tests/save-championship.test.ts`, `e2e/menus-progression.spec.ts` |
| 20 | Recuperação de dados | `src/tests/save-championship.test.ts`, `src/tests/racing.test.ts`, `e2e/menus-progression.spec.ts` |

---

## Checklist Honesto de Entrega (§27)

- [x] **O jogo iniciar corretamente.** (*Verificado em `e2e/boot.spec.ts` com 0 erros.*)
- [x] **Os oito personagens estiverem disponíveis.** (*Verificado em `garage.test.ts`, `tracks-eclipse.spec.ts` e manifesto.*)
- [x] **Os oito karts possuírem modelos definitivos.** (*Modelos GLB próprios sem formas genéricas em `public/assets/karts/`, verificados por `validate:assets` e `garage.test.ts`.*)
- [x] **As oito pistas estiverem finalizadas.** (*4 Copa Aurora + 4 Copa Eclipse com biomas, marcos, obstáculos móveis/gelo verificados em `tracks-aurora.test.ts` e `tracks-eclipse.test.ts`.*)
- [x] **Os adversários funcionarem.** (*7 oponentes IA físicos validados em Vitest e Playwright.*)
- [x] **A física estiver operacional.** (*Timestep fixo 60 Hz, 5 superfícies, rampas, boost pads verificados.*)
- [x] **O drift funcionar.** (*3 níveis com carregamento em pista no Vitest e no E2E.*)
- [x] **O turbo funcionar.** (*Miniturbos de drift, Boost Pads e Pulso Solar verificados.*)
- [x] **Os itens funcionarem.** (*6 itens ativos + roleta por posição em `items.test.ts`.*)
- [x] **As colisões funcionarem.** (*Kart×kart, paredes, obstáculos móveis e bolha guardiã em Vitest.*)
- [x] **Os checkpoints funcionarem.** (*Sequencialidade anti-corte e contramão em `racing.test.ts`.*)
- [x] **A classificação funcionar.** (*Ordenação 1º–8º em tempo real em `ai-standings.test.ts` e HUD.*)
- [x] **Os menus estiverem completos.** (*14 telas em PT-BR implementadas e navegadas no Playwright.*)
- [x] **O HUD estiver completo.** (*Posição, volta, tempo, velocímetro, drift, minimapa 8 corredores, item e alertas.*)
- [x] **Os efeitos estiverem integrados.** (*VFX em pool `InstancedMesh` + `particleAtlasShader.ts` + `speedLinesShader.ts` + luzes de relâmpago em Fortaleza Tempestade.*)
- [x] **As animações estiverem integradas.** (*9 clipes GLTF por piloto, rodas girando/esterçando e pás de moinho animadas.*)
- [x] **O áudio estiver integrado.** (*Howler.js 3 canais + sintetizador Web Audio contínuo de motor/drift.*)
- [x] **O campeonato funcionar.** (*4 etapas acumulam pontos e geram troféus em `save-championship.test.ts` e E2E `ETAPA 1/4`.*)
- [x] **O progresso for salvo.** (*Persistência `kart-legends-3d:save:v1` após reload no Playwright.*)
- [x] **Os testes forem executados.** (*46 testes Vitest + 7 testes Playwright E2E executados com 0 falhas.*)
- [x] **A build estiver disponível.** (*`npm run build` gerando `dist/` em <1 s — `813 ms`–`853 ms` nas verificações finais.*)
- [x] **Os assets possuírem licenças verificadas.** (*88/88 ativos com `Original-Project-License` auditados em `validate:assets`.*)
- [x] **Não existirem placeholders finais.** (*Zero cubos/cápsulas provisórias; áudio/texturas/GLBs reais em disco.*)
- [x] **Não existirem referências quebradas.** (*0 erros HTTP >= 400, 0 órfãos, 0 erros de console/página.*)

---

## Limitações Conhecidas & Observações

1. **Ferramenta Externa (`blender`):** O executável `blender` não está instalado neste host macOS. Consequentemente, a criação de todos os modelos GLB e animações esqueléticas ocorreu de forma programática e determinística via `@gltf-transform/core`, garantindo geometria multi-peça real, materiais PBR e clipes GLTF válidos sem bloquear o desenvolvimento, embora não substitua escultura manual externa em Blender caso desejada futuramente.
2. **Métrica de Desempenho vs. Meta Ideal de 60 FPS a 1080p:** Em resolução `1280×720` no Playwright headless Chrome + ANGLE Metal GPU neste equipamento, as médias observadas com 8 karts e VFX ativos ficaram entre **52,5 FPS e 54,1 FPS** (P95 `33,3 ms`, mínimo pontual entre `15,0 FPS` e `29,9 FPS`). Para hardware mais modesto, os perfis **Baixo** e **Médio** reduzem sombras, DPR e orçamento de partículas para priorizar estabilidade.
3. **Validação E2E de Conclusão de 3 Voltas e Pódio:** A finalização completa de 3 voltas e a tela final de Resultados/Pódio do Campeonato têm suas regras, pontuação e salvamento exaustivamente testados de forma determinística no Vitest (`racing.test.ts`, `save-championship.test.ts`), mantendo os testes E2E rápidos e determinísticos dentro do tempo de CI.
