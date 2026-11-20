import { expect, test } from '@playwright/test';

test.describe('KART LEGENDS 3D — Copa Eclipse Tracks (Lock + Practice Mode)', () => {
  test('enforces Eclipse lock in Quick Race and explores Fortaleza Tempestade in Practice Mode with zero errors', async ({
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

    // 1. Verify Copa Eclipse is locked in Quick Race (MÉDIO-09)
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('next-to-cup').click();
    await expect(page.getByTestId('cup-tab-eclipse')).toBeDisabled();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByRole('button', { name: 'Voltar' }).click();

    // 2. Practice Mode opens all 8 characters, 8 karts, and Copa Eclipse immediately
    await page.getByTestId('mode-option-practice').click();
    await page.getByTestId('char-option-zera').click();
    await page.getByTestId('next-to-kart').click();
    await page.getByTestId('kart-option-lamina-glacial').click();
    await page.getByTestId('next-to-cup').click();

    const eclipseTab = page.getByTestId('cup-tab-eclipse');
    await expect(eclipseTab).toBeEnabled();
    await eclipseTab.click();
    await page.getByTestId('next-to-track').click();

    const fortalezaBtn = page.getByTestId('track-option-fortaleza-tempestade');
    await expect(fortalezaBtn).toBeEnabled();
    await fortalezaBtn.click();
    await page.getByTestId('next-to-difficulty').click();
    await page.getByRole('button', { name: 'INICIAR CORRIDA' }).click();

    await expect(page.getByTestId('rank-badge')).toHaveText('TREINO LIVRE');
    await expect(page.getByText('Fortaleza Tempestade').first()).toBeVisible();
    await expect(page.getByTestId('countdown-callout')).toHaveText('JÁ!', { timeout: 10_000 });
    await expect(page.getByTestId('minimap-racer')).toHaveCount(1);

    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () => Number((await page.getByTestId('speedometer-value').textContent()) ?? '0'),
        { timeout: 6_000 },
      )
      .toBeGreaterThan(35);
    await page.keyboard.up('KeyW');

    await page.getByRole('button', { name: 'Encerrar Treino' }).click();
    await expect(page.getByRole('button', { name: 'JOGAR' })).toBeVisible();

    // 3. Switching back to Quick Race must revert locked Practice selections (ALTO-03)
    await page.getByRole('button', { name: 'Corrida Rápida' }).click();
    await expect(page.getByTestId('char-option-zera')).toBeDisabled();
    await expect(page.getByTestId('char-option-nilo')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('next-to-kart').click();
    await expect(page.getByTestId('kart-option-lamina-glacial')).toBeDisabled();
    await page.getByTestId('next-to-cup').click();
    await expect(page.getByTestId('cup-tab-eclipse')).toBeDisabled();
    await expect(page.getByTestId('cup-tab-aurora')).toHaveAttribute('aria-pressed', 'true');

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
