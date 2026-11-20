import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Slice 5 Copa Eclipse Tracks', () => {
  test('switches to Copa Eclipse, previews circuits and races 8 karts on Fortaleza Tempestade with zero errors', async ({
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

    const eclipseTab = page.getByTestId('cup-tab-eclipse');
    await expect(eclipseTab).toBeVisible({ timeout: 15_000 });
    await eclipseTab.click();
    await expect(eclipseTab).toHaveAttribute('aria-pressed', 'true');

    const neonBtn = page.getByTestId('track-option-cidade-neon');
    await expect(neonBtn).toBeVisible();
    await expect(neonBtn).toHaveAttribute('aria-pressed', 'true');

    const borealBtn = page.getByTestId('track-option-pico-boreal');
    await borealBtn.click();
    await expect(borealBtn).toHaveAttribute('aria-pressed', 'true');

    const celesteBtn = page.getByTestId('track-option-jardim-celeste');
    await celesteBtn.click();
    await expect(celesteBtn).toHaveAttribute('aria-pressed', 'true');

    const fortalezaBtn = page.getByTestId('track-option-fortaleza-tempestade');
    await fortalezaBtn.click();
    await expect(fortalezaBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Fortaleza Tempestade').first()).toBeVisible();

    const startBtn = page.getByRole('button', { name: 'INICIAR CORRIDA' });
    await startBtn.click();

    await expect(page.getByTestId('countdown-callout')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });
    await expect(page.getByTestId('minimap-racer')).toHaveCount(8);

    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () => {
          const text = await page.getByTestId('speedometer-value').textContent();
          return Number(text ?? '0');
        },
        { timeout: 6_000 },
      )
      .toBeGreaterThan(35);
    await page.keyboard.up('KeyW');

    const timerText = await page.getByTestId('race-timer').textContent();
    expect(timerText).not.toBe('00:00.000');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
