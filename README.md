# KART LEGENDS 3D

Jogo original de corrida de kart arcade 3D para navegador, construído com **React**, **TypeScript (strict)**, **Three.js / React Three Fiber**, **Rapier Physics**, **Zustand** e **Howler.js**.

> **Status Atual:** Slice 1 concluído (Núcleo jogável 1×1×1 com o piloto **Nilo** animado por GLTF `AnimationMixer`, kart **Trilha Raposa** multi-peça, pista **Porto das Lanternas**, física arcade em 60 Hz integrada ao Rapier, drift de 3 níveis com miniturbo, rampas, atalho de terra, câmera dinâmica, controles teclado/Gamepad e sistema de voltas/checkpoints anti-corte).

## Requisitos de Ambiente

- Node.js 22+ (`v26.7.0` validado)
- npm 10+
- `ffmpeg` (para transcodificação de áudio local no pipeline `npm run assets:build`)
- Google Chrome (para execução da suíte Playwright E2E com WebGL)

## Instalação

```bash
npm install
npm run assets:build
```

## Controles na Pista

- `W` / `Seta Cima`: Acelerar
- `S` / `Seta Baixo`: Frear / Marcha à ré
- `A` / `D` ou `Setas`: Virar
- `Espaço`: Saltar / Drift (Níveis 1, 2 e 3 com Miniturbo ao soltar)
- `R`: Recuperar kart no último checkpoint válido
- `Esc`: Pausar / Retomar
- Suporte completo à **Gamepad API**

## Comandos Disponíveis

- `npm run dev` — Inicia o servidor de desenvolvimento Vite.
- `npm run build` — Executa `tsc --noEmit` e gera o build de produção em `dist/`.
- `npm run preview` — Sobe o build de produção localmente na porta `4173`.
- `npm run typecheck` — Verificação estrita de tipos TypeScript.
- `npm run lint` — Análise estática com ESLint.
- `npm run test` — Executa os testes unitários no Vitest.
- `npm run test:e2e` — Executa os testes ponta a ponta no Playwright (Chrome + WebGL).
- `npm run assets:build` — Gera os assets locais (GLB, PNG, OGG) e atualiza `public/assets/manifest.json` e `ASSET_MANIFEST.md`.
- `npm run validate:assets` — Audita todos os arquivos em `public/assets/` contra o manifesto, checando formatos, licenças, integridade GLB/PNG/OGG, nós/animações obrigatórios e ausência de arquivos órfãos.

## Documentação Complementar

- Arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Manifesto de Assets: [ASSET_MANIFEST.md](ASSET_MANIFEST.md)
- Licenças: [LICENSES.md](LICENSES.md)
- Relatório de QA: [QA_REPORT.md](QA_REPORT.md)
