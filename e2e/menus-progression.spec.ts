import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Slice 6 Menus, Settings Persistence, Corruption Recovery & Modes', () => {
  test('recovers from corrupted localStorage, persists remapped controls & quality settings, checks Time Trial & Championship', async ({
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

    // Inject corrupted save before first load only if nothing saved yet
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('injected-corrupt')) {
        window.sessionStorage.setItem('injected-corrupt', '1');
        window.localStorage.setItem('kart-legends-3d:save:v1', '{broken_json_payload');
      }
    });

    await page.goto('/');

    // Recovery notice displayed cleanly
    await expect(
      page.getByText('Dados salvos inválidos foram detectados e restaurados com segurança.'),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Entendi' }).click();

    // Progression screen opens cleanly
    await page.getByRole('button', { name: 'Progressão e Troféus' }).click();
    await expect(page.getByRole('heading', { name: 'Progressão e Desbloqueios' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar ao Menu' }).click();

    // Settings screen: change quality & remap accelerate key -> persists across reload
    await page.getByRole('button', { name: 'Configurações' }).click();
    await page.getByTestId('quality-medium').click();
    await page.getByTestId('remap-accelerate').click();
    await page.keyboard.press('KeyI');
    await expect(page.getByTestId('remap-accelerate')).toHaveText('KeyI');
    await page.getByTestId('close-settings').click();

    await page.reload();
    await page.getByRole('button', { name: 'Configurações' }).click();
    await expect(page.getByTestId('quality-medium')).toHaveClass(/active/);
    await expect(page.getByTestId('remap-accelerate')).toHaveText('KeyI');
    await page.getByRole('button', { name: 'Restaurar Teclas Padrão' }).click();
    await expect(page.getByTestId('remap-accelerate')).toHaveText(/KeyW/);
    await page.getByTestId('close-settings').click();

    // Time Trial solo setup: no item slot, 1 minimap dot
    await page.getByRole('button', { name: 'JOGAR' }).click();
    await page.getByTestId('mode-option-time-trial').click();
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByTestId('rank-badge')).toHaveText('CONTRARRELÓGIO');
    await expect(page.getByTestId('item-slot')).toHaveCount(0);
    await expect(page.getByTestId('minimap-racer')).toHaveCount(1);

    // Pause -> Menu Principal -> verify Championship starts at ETAPA 1/4
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Menu Principal' }).click();

    await page.getByRole('button', { name: 'Campeonato' }).click();
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await page.getByTestId('next-to-track').click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByText('ETAPA 1/4')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
