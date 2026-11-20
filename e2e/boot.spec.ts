import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Slice 0 Boot & Calibration Stage', () => {
  test('renders WebGL canvas, initializes Rapier physics and loads validated asset manifest without runtime errors', async ({
    page,
  }) => {
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

    await expect(page.getByRole('heading', { name: 'KART LEGENDS 3D' })).toBeVisible();
    await expect(page.getByText('10 ativos')).toBeVisible({ timeout: 10_000 });

    // Wait for Rapier fixed-timestep loop to execute non-zero steps and R3F canvas to size
    await expect(page.getByText(/60 Hz \([1-9]\d* steps\)/)).toBeVisible({ timeout: 15_000 });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(800);
    expect(box!.height).toBeGreaterThan(400);

    // Test interactive audio button (unlocks Web Audio / Howler cleanly on click)
    const audioBtn = page.getByRole('button', { name: /Testar Áudio/i });
    await expect(audioBtn).toBeEnabled();
    await audioBtn.click();
    await expect(page.getByRole('button', { name: 'Áudio Confirmado (Howler.js)' })).toBeVisible({
      timeout: 5_000,
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
