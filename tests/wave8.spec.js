// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 8 — Conquistas', () => {
  test('cadastro -> abrir conquistas -> aplicar conceito Business Master -> conquista desbloqueia', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave8-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave8');
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

    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await expect(navPerfil).toBeVisible({ timeout: 10000 });

    await clickTo(page, navPerfil, page.getByText('Conquistas', { exact: true }));
    await clickTo(page, page.getByText('Conquistas', { exact: true }), page.getByRole('heading', { name: 'Conquistas' }));

    await expect(page.getByText('DESBLOQUEADAS')).toBeVisible();
    await expect(page.getByText('Primeiro conceito', { exact: true })).toBeVisible();
    await expect(page.getByText('Primeiro conceito', { exact: true }).locator('..').getByText('Conquistado')).toHaveCount(0);

    // Aplica um conceito do Business Master (área Profissional) e volta.
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Perfil' }));
    const navEvoluir = page.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
    await clickTo(page, navEvoluir, page.getByText('Minha Evolução'));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Profissional', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Value Score e Business Master'), page.getByText('BUSINESS MASTER', { exact: true }));
    await page.locator('.concept-item').first().getByRole('button', { name: 'Marcar como aplicado' }).click({ force: true });
    await expect(page.locator('.concept-item').first().getByText('Já apliquei')).toBeVisible();

    // Verifica que a conquista desbloqueou
    await clickTo(page, navPerfil, page.getByText('Conquistas', { exact: true }));
    await clickTo(page, page.getByText('Conquistas', { exact: true }), page.getByRole('heading', { name: 'Conquistas' }));
    const card = page.locator('.card', { hasText: 'Primeiro conceito' });
    await expect(card.getByText('Conquistado')).toBeVisible({ timeout: 10000 });

    // Limpeza
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Perfil' }));
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync|Failed to load resource/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
