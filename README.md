# KART LEGENDS 3D

Jogo original de corrida de kart arcade 3D para navegador, construído com **React**, **TypeScript (strict)**, **Three.js / React Three Fiber**, **Rapier Physics**, **Zustand** e **Howler.js**.

> **Status Atual:** Slice 0 concluído (Fundação técnica, catálogos completos, pipeline local de assets GLB/PNG/OGG, validador automatizado, cena de calibração WebGL + Rapier e suíte de testes unitários e E2E).

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

## Comandos Disponíveis

- `npm run dev` — Inicia o servidor de desenvolvimento Vite.
- `npm run build` — Executa `tsc --noEmit` e gera o build de produção em `dist/`.
- `npm run preview` — Sobe o build de produção localmente na porta `4173`.
- `npm run typecheck` — Verificação estrita de tipos TypeScript.
- `npm run lint` — Análise estática com ESLint.
- `npm run test` — Executa os testes unitários no Vitest.
- `npm run test:e2e` — Executa os testes ponta a ponta no Playwright (Chrome + WebGL).
- `npm run assets:build` — Gera os assets locais (GLB, PNG, OGG) e atualiza `public/assets/manifest.json` e `ASSET_MANIFEST.md`.
- `npm run validate:assets` — Audita todos os arquivos em `public/assets/` contra o manifesto, checando formatos, licenças, integridade GLB/PNG/OGG e ausência de arquivos órfãos.

## Estrutura do Projeto

Veja os detalhes completos da arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), registro de assets em [ASSET_MANIFEST.md](ASSET_MANIFEST.md), licenças em [LICENSES.md](LICENSES.md) e o relatório de verificação em [QA_REPORT.md](QA_REPORT.md).
