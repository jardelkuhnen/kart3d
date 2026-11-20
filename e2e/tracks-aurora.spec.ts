import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Slice 4 Copa Aurora Tracks', () => {
  test('switches cleanly between Copa Aurora tracks and races 8 karts in Vale dos Moinhos with zero errors', async ({
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

    const bosqueBtn = page.getByTestId('track-option-bosque-de-cristal');
    await expect(bosqueBtn).toBeVisible({ timeout: 15_000 });
    await bosqueBtn.click();
    await expect(bosqueBtn).toHaveAttribute('aria-pressed', 'true');

    const canionBtn = page.getByTestId('track-option-canion-solar');
    await canionBtn.click();
    await expect(canionBtn).toHaveAttribute('aria-pressed', 'true');

    const valeBtn = page.getByTestId('track-option-vale-dos-moinhos');
    await valeBtn.click();
    await expect(valeBtn).toHaveAttribute('aria-pressed', 'true');

    // Bottom badge displays selected track name
    await expect(page.getByText('Vale dos Moinhos').first()).toBeVisible();

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
