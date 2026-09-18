// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 9 — Benchmark anônimo por idade (melhor esforço)', () => {
  test('cadastro -> informar ano de nascimento -> Minha Evolução não quebra (com ou sem tabela)', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave9-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave9');
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

    // Ativa a área Saúde e informa o ano de nascimento (necessário pro benchmark).
    await clickTo(page, navEvoluir, page.getByText('Minha Evolução'));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Saúde', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Perfil de saúde e Health Score'), page.getByText('PERFIL DE SAÚDE'));
    await page.locator('input[type="number"]').first().fill('1990');
    await page.locator('input[type="number"]').first().blur();
    await page.waitForTimeout(300);
    await page.locator('select').nth(1).selectOption('no'); // não fumante -> gera um health score
    await page.waitForTimeout(500); // dá tempo pro store.mutate() persistir/sincronizar o birthYear

    // Volta pra Minha Evolução — não deve travar nem gerar erro, com ou sem a tabela.
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Minha Evolução' }));
    await expect(page.getByText('MONTRO SCORE')).toBeVisible();
    await page.waitForTimeout(1500);

    // Limpeza
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Evoluir' }));
    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync|Failed to load resource/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
