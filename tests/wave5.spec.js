// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Onda 5 — Central de Notificações', () => {
  test('cadastro -> abrir notificações -> desativar/ativar toggle -> salvar horário', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave5-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave5');
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

    await clickTo(page, navPerfil, page.getByText('Notificações', { exact: true }));
    await clickTo(page, page.getByText('Notificações', { exact: true }), page.getByRole('heading', { name: 'Notificações' }));

    await expect(page.getByText('PERMISSÃO DO NAVEGADOR')).toBeVisible();
    await expect(page.getByText('Lembrete diário', { exact: true })).toBeVisible();

    // Horário do lembrete diário é editado num modal (fora da árvore que se
    // redesenha sozinha) — evita perder o valor digitado num redraw no meio.
    // Sem force aqui (o botão pode ficar perto da nav fixa em viewports largos
    // — um clique forçado por coordenada pode acertar a nav por trás).
    await expect(async () => {
      await page.getByRole('button', { name: 'Editar' }).click();
      await expect(page.locator('#modal-root input[type="time"]')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000, intervals: [300, 500, 1000] });
    await page.locator('#modal-root input[type="time"]').fill('20:30');
    await page.locator('#modal-root').getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Configurado para 20:30')).toBeVisible({ timeout: 10000 });

    const dailyRow = page.locator('.card-tight', { hasText: 'Lembrete diário' });
    await expect(dailyRow.getByRole('button', { name: 'Ativado' })).toBeVisible();
    await dailyRow.getByRole('button', { name: 'Ativado' }).click({ force: true });
    await expect(dailyRow.getByRole('button', { name: 'Desativado' })).toBeVisible();

    // Limpeza
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), navPerfil);
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync|Failed to load resource/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
