import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs/screenshots');

interface PerfSample {
  frames: number;
  durationMs: number;
  avgFps: number;
  minFps: number;
  p95FrameMs: number;
  heapUsedMB: number | null;
}

test.describe('KART LEGENDS 3D — Slice 7 VFX, Screenshots & Performance Benchmark', () => {
  test('captures Main Menu, Garage Showcase, and Porto race VFX screenshots + measures live WebGL FPS', async ({
    page,
  }) => {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 400) {
        consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'KART LEGENDS 3D' })).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'main_menu.png') });

    // Garage Character 3D Showcase
    await page.getByRole('button', { name: 'Corrida Rápida' }).click();
    const lumiBtn = page.getByTestId('char-option-lumi');
    await expect(lumiBtn).toBeVisible({ timeout: 10_000 });
    await lumiBtn.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'garage_showcase.png') });

    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });

    // Accelerate and drift to activate particle pool & speed lines
    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () => Number((await page.getByTestId('speedometer-value').textContent()) ?? '0'),
        { timeout: 6_000 },
      )
      .toBeGreaterThan(35);

    await page.keyboard.down('Space');
    await page.keyboard.down('KeyA');
    await expect(page.getByText(/CARREGANDO DRIFT|DRIFT NV\./i)).toBeVisible({ timeout: 4_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'race_porto.png') });

    // Measure live requestAnimationFrame frame rate over ~2.0s while accelerating + drifting
    const metrics = await page.evaluate<PerfSample>(async () => {
      return new Promise((resolve) => {
        const timestamps: number[] = [];
        const start = performance.now();

        const step = (now: number) => {
          timestamps.push(now);
          if (now - start >= 2000 && timestamps.length >= 10) {
            const deltas: number[] = [];
            for (let i = 1; i < timestamps.length; i++) {
              deltas.push(Math.max(1, timestamps[i]! - timestamps[i - 1]!));
            }
            const sorted = [...deltas].sort((a, b) => a - b);
            const totalDuration = timestamps[timestamps.length - 1]! - timestamps[0]!;
            const avgFps = (deltas.length * 1000) / Math.max(1, totalDuration);
            const maxDelta = sorted[sorted.length - 1] ?? 16.67;
            const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
            const p95FrameMs = sorted[p95Idx] ?? 16.67;
            const minFps = 1000 / Math.max(1, maxDelta);
            const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
            const heapUsedMB = mem ? Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)) : null;

            resolve({
              frames: timestamps.length,
              durationMs: Math.round(totalDuration),
              avgFps: Number(avgFps.toFixed(1)),
              minFps: Number(minFps.toFixed(1)),
              p95FrameMs: Number(p95FrameMs.toFixed(1)),
              heapUsedMB,
            });
            return;
          }
          requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      });
    });

    await page.keyboard.up('KeyA');
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyW');

    console.log(`[SLICE7_PERF_METRICS] ${JSON.stringify(metrics)}`);
    expect(metrics.frames).toBeGreaterThanOrEqual(25);
    expect(metrics.avgFps).toBeGreaterThanOrEqual(15);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('captures Fortaleza Tempestade weather race screenshot and validates low-quality preset runtime path', async ({
    page,
  }) => {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 400) {
        consoleErrors.push(`HTTP ${res.status()} ${res.url()}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'JOGAR' }).click();
    await page.getByTestId('mode-option-practice').click();
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await page.getByTestId('cup-tab-eclipse').click();
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('track-option-fortaleza-tempestade').click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });
    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () => Number((await page.getByTestId('speedometer-value').textContent()) ?? '0'),
        { timeout: 6_000 },
      )
      .toBeGreaterThan(35);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'race_fortaleza.png') });
    await page.keyboard.up('KeyW');

    // End practice -> switch to Baixo quality preset -> verify Porto practice renders with zero errors
    await page.getByRole('button', { name: 'Encerrar Treino' }).click();
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByTestId('quality-low').click();
    await expect(page.getByTestId('quality-low')).toHaveClass(/active/);
    await page.getByTestId('close-settings').click();

    await page.getByRole('button', { name: 'JOGAR' }).click();
    await page.getByTestId('mode-option-practice').click();
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });
    await expect(page.locator('canvas')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
