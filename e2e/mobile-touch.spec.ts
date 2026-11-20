import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'docs/screenshots');

test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});

test.describe('KART LEGENDS 3D — Slice 8 Mobile Touch, Viewport, iOS PWA & Ergonomics', () => {
  test('auto-enables TouchControls + low quality preset, drives via auto-accelerate, drifts via multitouch & overrides with brake', async ({
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

    // Verify PWA / iOS viewport-fit=cover & touch-action / callout CSS protections
    const mobileEnv = await page.evaluate(() => {
      const viewportMeta =
        document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';
      const iosCapable =
        document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content') ??
        '';
      const manifestHref =
        document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '';
      const rootStyle = window.getComputedStyle(document.getElementById('root')!);
      return {
        viewportMeta,
        iosCapable,
        manifestHref,
        touchAction: rootStyle.touchAction,
        userSelect: rootStyle.userSelect || rootStyle.webkitUserSelect,
      };
    });
    expect(mobileEnv.viewportMeta).toContain('viewport-fit=cover');
    expect(mobileEnv.iosCapable).toBe('yes');
    expect(mobileEnv.manifestHref).toBe('/manifest.webmanifest');
    expect(mobileEnv.touchAction).toBe('none');
    expect(mobileEnv.userSelect).toBe('none');

    // Settings should auto-select Baixa quality & Touch Auto + Auto-Accelerate on mobile
    await page.getByRole('button', { name: 'Configurações' }).click();
    await expect(page.getByTestId('quality-low')).toHaveClass(/active/);
    await expect(page.getByTestId('touch-mode-auto')).toHaveClass(/active/);
    await expect(page.getByTestId('touch-auto-accel-toggle')).toHaveClass(/active/);
    await page.getByTestId('close-settings').click();

    // Start Quick Race in mobile landscape viewport (844x390)
    await page.getByRole('button', { name: 'Corrida Rápida' }).click();
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });

    // TouchControls appear automatically on touch viewport
    const touchRoot = page.getByTestId('touch-controls');
    await expect(touchRoot).toBeVisible();
    await expect(page.getByTestId('touch-steer-pad')).toBeVisible();
    await expect(page.getByTestId('touch-btn-drift')).toBeVisible();
    await expect(page.getByTestId('touch-btn-item')).toBeVisible();
    await expect(page.getByTestId('touch-btn-brake')).toBeVisible();
    await expect(page.getByTestId('touch-btn-recover')).toBeVisible();
    await expect(page.getByTestId('touch-auto-accel-badge')).toBeVisible();

    // Auto-accelerate launches the kart past 35 km/h without any keyboard presses
    await expect
      .poll(
        async () => Number((await page.getByTestId('speedometer-value').textContent()) ?? '0'),
        { timeout: 6_000 },
      )
      .toBeGreaterThan(35);

    // Dispatch simultaneous multitouch PointerEvents (finger 101 steering left + finger 102 holding DRIFT)
    await page.evaluate(() => {
      const pad = document.querySelector('[data-testid="touch-steer-pad"]')!;
      const driftBtn = document.querySelector('[data-testid="touch-btn-drift"]')!;
      const pRect = pad.getBoundingClientRect();
      const dRect = driftBtn.getBoundingClientRect();

      pad.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 101,
          pointerType: 'touch',
          clientX: pRect.left + pRect.width * 0.15,
          clientY: pRect.top + pRect.height * 0.5,
        }),
      );
      driftBtn.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 102,
          pointerType: 'touch',
          clientX: dRect.left + dRect.width * 0.5,
          clientY: dRect.top + dRect.height * 0.5,
        }),
      );
    });

    await expect(page.getByText(/CARREGANDO DRIFT|DRIFT NV\./i)).toBeVisible({ timeout: 4_000 });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'mobile_race_landscape.png') });

    // Release multitouch steer & drift cleanly, then press brake to verify speed reduction
    await page.evaluate(() => {
      const pad = document.querySelector('[data-testid="touch-steer-pad"]')!;
      const driftBtn = document.querySelector('[data-testid="touch-btn-drift"]')!;
      const brakeBtn = document.querySelector('[data-testid="touch-btn-brake"]')!;
      const bRect = brakeBtn.getBoundingClientRect();

      driftBtn.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: 102,
          pointerType: 'touch',
        }),
      );
      pad.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: 101,
          pointerType: 'touch',
        }),
      );
      brakeBtn.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 103,
          pointerType: 'touch',
          clientX: bRect.left + bRect.width * 0.5,
          clientY: bRect.top + bRect.height * 0.5,
        }),
      );
    });

    await expect
      .poll(
        async () => Number((await page.getByTestId('speedometer-value').textContent()) ?? '0'),
        { timeout: 6_000 },
      )
      .toBeLessThan(35);

    await page.evaluate(() => {
      const brakeBtn = document.querySelector('[data-testid="touch-btn-brake"]')!;
      brakeBtn.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: 103,
          pointerType: 'touch',
        }),
      );
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
