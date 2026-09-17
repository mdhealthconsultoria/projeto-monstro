// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 3 — Sistema de Conhecimento', () => {
  test('cadastro -> criar item -> avançar etapa -> registrar sessão -> score sobe -> excluir', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave3-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave3');
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

    // ---- Conhecimento ----
    await clickTo(page, navEvoluir, page.getByText('Minha Evolução'));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Conhecimento', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));

    const areaScoreNum = page.locator('.montro-hero-num').first();
    await expect(areaScoreNum).toHaveText('—');

    await clickTo(page, page.getByText('Sistema de domínio'), page.getByRole('heading', { name: 'Conhecimento' }));

    await page.locator('input[type="text"]').fill('Inglês avançado');
    await page.getByRole('button', { name: 'Adicionar' }).click({ force: true });
    await expect(page.getByText('Inglês avançado')).toBeVisible();
    await expect(page.locator('.knowledge-item').first().getByText('Estudar', { exact: true })).toBeVisible();

    const card = page.locator('.knowledge-item').first();
    await card.getByRole('button', { name: 'Avançar etapa' }).click({ force: true });
    await expect(card.getByText('Testar', { exact: true })).toBeVisible();

    await card.locator('input[type="number"]').fill('45');
    await card.getByRole('button', { name: 'Registrar sessão' }).click({ force: true });
    await expect(card.getByText('1 sessão · 45 min registrados')).toBeVisible();

    // Voltar pra área e conferir que o score não é mais "—"
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await expect(areaScoreNum).not.toHaveText('—');

    // Limpeza: excluir o item
    await clickTo(page, page.getByText('Sistema de domínio'), page.getByRole('heading', { name: 'Conhecimento' }));
    await page.locator('.knowledge-item').first().getByRole('button', { name: 'Excluir' }).click({ force: true });
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir' }).click();
    await expect(page.getByText('Nenhum item ainda')).toBeVisible();

    // Limpeza: apaga a conta de teste
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByText('PONTUAÇÃO DA ÁREA'));
    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
