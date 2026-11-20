import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Slice 3 Characters, Karts, 8-Racer Race, Items, HUD & Audio', () => {
  test('selects custom character Lumi & Cometa Estelar kart, picks difficulty, races, drifts, toggles mute & pauses cleanly', async ({
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

    // Select a non-default character (Lumi) and non-default kart (Cometa Estelar)
    const lumiBtn = page.getByTestId('char-option-lumi');
    await expect(lumiBtn).toBeVisible({ timeout: 15_000 });
    await lumiBtn.click();
    await expect(lumiBtn).toHaveAttribute('aria-pressed', 'true');

    const cometaBtn = page.getByTestId('kart-option-cometa-estelar');
    await expect(cometaBtn).toBeVisible();
    await cometaBtn.click();
    await expect(cometaBtn).toHaveAttribute('aria-pressed', 'true');

    // Bottom HUD badge reflects the selected driver
    await expect(page.getByRole('img', { name: 'Lumi' }).first()).toBeVisible();

    // Difficulty selector works cleanly
    const hardBtn = page.getByRole('button', { name: 'Difícil' });
    await hardBtn.click();

    const startBtn = page.getByRole('button', { name: 'INICIAR CORRIDA' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Countdown transitions to JÁ!
    await expect(page.getByTestId('countdown-callout')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });

    // Rank badge, Minimap with 8 racers and Item Slot are visible
    await expect(page.getByTestId('rank-badge')).toHaveText(/^[1-8]º$/);
    await expect(page.getByTestId('minimap')).toBeVisible();
    await expect(page.getByTestId('minimap-racer')).toHaveCount(8);
    await expect(page.getByTestId('item-slot')).toBeVisible();

    // Accelerate with KeyW and verify speed climbs
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

    // Drift with Space + KeyA and trigger ShiftLeft item slot
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyA');
    await expect(page.getByText(/CARREGANDO DRIFT|DRIFT NV\./i)).toBeVisible({
      timeout: 4_000,
    });
    await page.keyboard.up('KeyA');
    await page.keyboard.up('Space');
    await page.keyboard.press('ShiftLeft');
    await page.keyboard.up('KeyW');

    // Race timer ticks up
    const timerText = await page.getByTestId('race-timer').textContent();
    expect(timerText).not.toBe('00:00.000');

    // Mute toggle works cleanly
    const muteBtn = page.getByRole('button', { name: /Silenciar Som/i });
    await muteBtn.click();
    await expect(page.getByRole('button', { name: /Ativar Som/i })).toBeVisible();

    // Pause via Escape & resume via button
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
