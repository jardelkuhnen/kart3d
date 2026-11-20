# QA REPORT — KART LEGENDS 3D

**Status Geral do Projeto:** **PARCIAL** (Slices 0 e 1 de 8 concluídos e verificados; Slices 2–7 em andamento).

---

## Slice 0 — Fundação, Arquitetura e Pipeline de Assets

| Comando | Resultado | Observações |
| :--- | :--- | :--- |
| `npm run assets:build` | PASS | 10 ativos iniciais gerados e manifestados |
| `npm run validate:assets` | PASS | 10 ativos verificados, 0 erros, 0 arquivos órfãos |
| `npm run typecheck` | PASS | 0 erros |
| `npm run lint` | PASS | 0 erros e 0 avisos |
| `npm run test` | PASS | 3 arquivos, 10 testes aprovados |
| `npm run build` | PASS | Build de produção gerada em `dist/` |
| `npm run test:e2e` | PASS | 1/1 aprovado em Playwright |

---

## Slice 1 — Núcleo Jogável 1×1×1 (Nilo + Trilha Raposa + Porto das Lanternas)

### Verificações Executadas

| Comando | Resultado | Observações |
| :--- | :--- | :--- |
| `npm run assets:build` | PASS | 15 ativos gerados em `public/assets/`, incluindo `nilo.glb` (9 animações GLTF), `trilha_raposa.glb` (10 nós) e `porto_das_lanternas.glb` (978 m) |
| `npm run validate:assets` | PASS | 15 ativos verificados, 0 erros, 0 arquivos órfãos |
| `npm run typecheck` | PASS | `tsc --noEmit` (strict) com 0 erros |
| `npm run lint` | PASS | `eslint .` com 0 erros e 0 avisos (React 19 hooks + TS strict) |
| `npm run test` | PASS | Vitest: 6 arquivos, 21 testes aprovados (`core`, `catalog`, `manifest`, `physics`, `racing`, `input`) |
| `npm run build` | PASS | Build de produção Vite gerada em `dist/` (588 módulos em 754 ms) |
| `npm run test:e2e` | PASS | Playwright (Chrome + ANGLE Metal GPU): 2/2 aprovados (`boot.spec.ts` em 4.3 s, `race-core.spec.ts` em 15.1 s), aceleração, drift, recuperação `R`, pausa `ESC` e zero erros de console/página/HTTP |

### Escopo Entregue no Slice 1

- Piloto **Nilo** (`nilo.glb`) com rig animado e 9 clipes GLTF reais (`idle`, `drive`, `turnLeft`, `turnRight`, `drift`, `hit`, `victory`, `defeat`, `podium`) + retrato e ícone de HUD.
- Kart **Trilha Raposa** (`trilha_raposa.glb`) com chassi multi-peça, 4 rodas independentes (esterço + rotação), volante animado, suspensão visual e escapes com chamas de turbo.
- Pista **Porto das Lanternas** (`porto_das_lanternas.glb` + `portoDasLanternas.ts`) com asfalto texturizado, zebras de curva, barreiras de pedra com colisores Rapier, pórtico de largada, farol costeiro, casas, barcos animados, mercado, ponte, túnel, rampas, painéis de impulso e atalho de terra.
- Física arcade determinística em 60 Hz integrada ao Rapier, suporte às 5 superfícies, drift em 3 níveis com faíscas/fumaça/miniturbo, câmera dinâmica multi-estado, controles teclado/Gamepad e sistema de 3 voltas com 12 checkpoints anti-corte.
