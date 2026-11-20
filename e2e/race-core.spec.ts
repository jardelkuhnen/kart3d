import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Slice 1 Core Gameplay Loop', () => {
  test('starts race, runs countdown, accelerates, drifts, pauses and recovers cleanly', async ({
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

    const startBtn = page.getByRole('button', { name: 'INICIAR CORRIDA' });
    await expect(startBtn).toBeVisible({ timeout: 15_000 });
    await startBtn.click();

    // Countdown transitions cleanly through 3 -> JÁ! and enters live racing
    await expect(page.getByTestId('countdown-callout')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });

    // Accelerate straight using KeyW and verify speedometer climbs above 35 km/h
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

    // Engage drift with Space + KeyA and verify HUD drift state triggers
    await page.keyboard.down('Space');
    await page.keyboard.down('KeyA');
    await expect(page.getByText(/CARREGANDO DRIFT|DRIFT NV\./i)).toBeVisible({
      timeout: 4_000,
    });
    await page.keyboard.up('KeyA');
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyW');

    // Race timer should have advanced beyond 00:00.000
    const timerText = await page.getByTestId('race-timer').textContent();
    expect(timerText).not.toBe('00:00.000');

    // Trigger recovery key R safely without errors
    await page.keyboard.press('KeyR');

    // Toggle pause via Escape and resume via button
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
