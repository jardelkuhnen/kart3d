import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Core 8-Racer Quick Race Flow', () => {
  test('navigates Main Menu -> Garage (Lumi + Cometa Estelar) -> Difficulty -> Race, drives, drifts, toggles mute & pauses cleanly', async ({
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
    await page.getByRole('button', { name: 'Corrida Rápida' }).click();

    // Character Select Showcase
    const lumiBtn = page.getByTestId('char-option-lumi');
    await expect(lumiBtn).toBeVisible({ timeout: 10_000 });
    await lumiBtn.click();
    await expect(lumiBtn).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('next-to-kart').click();

    // Kart Select Showcase
    const cometaBtn = page.getByTestId('kart-option-cometa-estelar');
    await expect(cometaBtn).toBeVisible();
    await cometaBtn.click();
    await expect(cometaBtn).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('next-to-cup').click();

    // Cup -> Track -> Difficulty
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('next-to-difficulty').click();

    const hardBtn = page.getByRole('button', { name: 'Difícil' });
    await hardBtn.click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    // Countdown transitions to JÁ!
    await expect(page.getByTestId('countdown-callout')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });

    await expect(page.getByTestId('rank-badge')).toHaveText(/^[1-8]º$/);
    await expect(page.getByTestId('minimap')).toBeVisible();
    await expect(page.getByTestId('minimap-racer')).toHaveCount(8);
    await expect(page.getByTestId('item-slot')).toBeVisible();

    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () => Number((await page.getByTestId('speedometer-value').textContent()) ?? '0'),
        { timeout: 6_000 },
      )
      .toBeGreaterThan(35);

    await page.keyboard.down('Space');
    await page.keyboard.down('KeyA');
    await expect(page.getByText(/CARREGANDO DRIFT|DRIFT NV\./i)).toBeVisible({
      timeout: 4_000,
    });
    await page.keyboard.up('KeyA');
    await page.keyboard.up('Space');
    await page.keyboard.press('ShiftLeft');
    await page.keyboard.up('KeyW');

    const timerText = await page.getByTestId('race-timer').textContent();
    expect(timerText).not.toBe('00:00.000');

    const muteBtn = page.getByRole('button', { name: /Silenciar Som/i });
    await muteBtn.click();
    await expect(page.getByRole('button', { name: /Ativar Som/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'CORRIDA PAUSADA' })).toBeVisible({
      timeout: 3_000,
    });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'CORRIDA PAUSADA' })).toBeHidden();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
