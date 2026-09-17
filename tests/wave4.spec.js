// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 4 — Central de Ajuda', () => {
  test('cadastro -> Central de Ajuda -> abrir FAQ -> preencher relato', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave4-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave4');
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

    await clickTo(page, navPerfil, page.getByText('Central de Ajuda'));
    await clickTo(page, page.getByText('Central de Ajuda'), page.getByRole('heading', { name: 'Central de Ajuda' }));

    await expect(page.getByText('O que é o Montro Score?')).toBeVisible();
    await expect(page.getByText('É a média das áreas da vida')).not.toBeVisible();
    await page.getByText('O que é o Montro Score?').click({ force: true });
    await expect(page.getByText('É a média das áreas da vida', { exact: false })).toBeVisible();

    await page.locator('textarea').fill('Teste automatizado de relato de problema.');
    await expect(page.getByRole('button', { name: 'Enviar por e-mail' })).toBeVisible();

    // Limpeza
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), navPerfil);
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
