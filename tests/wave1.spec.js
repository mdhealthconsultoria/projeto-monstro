// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

// Same force-click + retry pattern as tests/areas.spec.js: any click that also
// triggers store.mutate() can occasionally race Playwright's click-stability
// check against the app's full-DOM-remount-on-state-change architecture.
async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 1 — Foco + Saúde', () => {
  test('cadastro -> Foco (start/pause/reset) -> Saúde (perfil + medição)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave1-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave1');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').nth(0).fill(password);
    await page.locator('input[type="password"]').nth(1).fill(password);
    await page.getByRole('button', { name: 'Criar conta' }).click();

    const confirmScreen = page.getByText(/confirme seu e-mail|verifique seu e-mail/i);
    if (await confirmScreen.isVisible({ timeout: 4000 }).catch(() => false)) {
      throw new Error('Confirmação de e-mail está ativa — não dá pra testar cadastro automatizado. Teste manual necessário.');
    }

    // Onboarding
    await page.locator('.option-row').first().click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Ainda não' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.locator('.option-row').first().click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Concluir' }).click();

    const navEvoluir = page.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
    await expect(navEvoluir).toBeVisible({ timeout: 10000 });

    // ---- Foco ----
    await clickTo(page, navEvoluir, page.getByText('Foco', { exact: true }));
    await clickTo(page, page.getByText('Foco', { exact: true }), page.getByRole('heading', { name: 'Foco' }));

    await expect(page.getByText('Iniciar foco (25 min)')).toBeVisible();
    await expect(page.locator('.focus-countdown')).toHaveText('25:00');

    await clickTo(page, page.getByRole('button', { name: /Iniciar foco/ }), page.getByRole('button', { name: 'Pausar' }));
    await expect(page.locator('.pill', { hasText: 'Foco' })).toBeVisible();

    await clickTo(page, page.getByRole('button', { name: 'Pausar' }), page.getByRole('button', { name: 'Retomar' }));
    await clickTo(page, page.getByRole('button', { name: 'Retomar' }), page.getByRole('button', { name: 'Pausar' }));
    await clickTo(page, page.getByRole('button', { name: 'Reiniciar' }), page.getByText('Iniciar foco (25 min)'));

    // ---- Saúde ----
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Evoluir' }));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Saúde', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Perfil de saúde e Health Score'), page.getByText('PERFIL DE SAÚDE'));

    await expect(page.getByText('HEALTH SCORE')).toBeVisible();
    const scoreNum = page.locator('.montro-hero-num').first();
    await expect(scoreNum).toHaveText('—');

    await page.locator('select').nth(1).selectOption('no'); // Tabagismo: Não fumo
    await expect(page.locator('.montro-hero-num').first()).not.toHaveText('—');

    // Medição
    await page.locator('input[type="number"]').last().fill('120');
    await page.getByRole('button', { name: 'Registrar' }).click({ force: true });
    await expect(page.getByText('Pressão sistólica', { exact: true })).toBeVisible();
    await expect(page.getByText('120 mmHg')).toBeVisible();

    await page.getByRole('button', { name: 'Excluir' }).click({ force: true });
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByText('Nenhuma medição registrada ainda.')).toBeVisible();

    // Limpeza
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByText('PONTUAÇÃO DA ÁREA'));
    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
