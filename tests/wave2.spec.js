// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 2 — Jornada de 90 dias + Value Score', () => {
  test('cadastro -> iniciar jornada -> ver fase -> aplicar conceito -> Value Score sobe', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave2-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave2');
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

    // ---- Jornada de 90 dias ----
    await clickTo(page, navEvoluir, page.getByText('Jornada de 90 dias', { exact: true }));
    await clickTo(page, page.getByText('Jornada de 90 dias', { exact: true }), page.getByRole('heading', { name: 'Jornada de 90 dias' }));

    await expect(page.getByText('Começar jornada de 90 dias')).toBeVisible();
    await expect(page.getByText('Construção · dias 1–30')).toBeVisible();

    await clickTo(page, page.getByRole('button', { name: 'Começar jornada de 90 dias' }), page.getByText('FASE: CONSTRUÇÃO'));
    await expect(page.getByText('Dia 1/90')).toBeVisible();
    await expect(page.getByText('Dias com pelo menos um hábito marcado')).toBeVisible();

    // ---- Value Score / Business Master ----
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Evoluir' }));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Profissional', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Value Score e Business Master'), page.getByText('BUSINESS MASTER', { exact: true }));

    const scoreNum = page.locator('.montro-hero-num').first();
    await expect(scoreNum).toHaveText('—');

    const firstConcept = page.locator('.concept-item').first();
    await firstConcept.getByRole('button', { name: 'Marcar como aplicado' }).click({ force: true });
    await expect(firstConcept.getByText('Já apliquei')).toBeVisible();
    await expect(scoreNum).not.toHaveText('—');

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
