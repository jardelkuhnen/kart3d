import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Boot & Main Menu 3D Stage', () => {
  test('boots WebGL 3D world onto Main Menu with zero runtime errors', async ({ page }) => {
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
    await expect(page.getByRole('button', { name: 'JOGAR' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Progressão e Troféus' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configurações' })).toBeVisible();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(800);
    expect(box!.height).toBeGreaterThan(400);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
