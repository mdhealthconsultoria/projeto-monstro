// @ts-check
// Fase 0.4 — deleteAccount() precisa apagar a linha em auth.users de verdade
// (via a Edge Function delete-account, service_role), não só os dados da
// conta. Prova isso tentando logar de novo com o mesmo e-mail/senha depois
// de excluir: se a credencial ainda existir, o login teria sucesso (bug
// antigo); com a function publicada e funcionando, tem que falhar.
//
// Esse teste SÓ passa depois que a Edge Function delete-account estiver
// publicada e respondendo certo ao preflight CORS (ver
// supabase/functions/delete-account/index.ts) — enquanto isso, deleteAccount()
// cai no fallback antigo (apaga só os dados, mantém a credencial) e este
// teste falha de propósito, apontando exatamente esse gap.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Fase 0.4 — exclusão de conta apaga a credencial de verdade', () => {
  test('depois de excluir a conta, login com o mesmo e-mail/senha falha', async ({ page }) => {
    test.setTimeout(60000);

    const email = `qa-delete-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Delete');
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

    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    // Volta pra tela de login/landing depois de excluir.
    await expect(page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' })).toBeVisible({ timeout: 10000 });

    // Tenta logar de novo com a MESMA credencial — tem que falhar, provando
    // que a linha em auth.users foi apagada de verdade (não só os dados).
    await page.getByRole('button', { name: 'Já tenho uma conta' }).click();
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText(/e-mail ou senha inválidos/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('navigation')).not.toBeVisible();
  });
});
