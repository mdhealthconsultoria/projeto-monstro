// @ts-check
// Fase 0.3 (ponto 3 da revisão do PR) — loadForUser() não pode descartar um
// lado inteiro quando os dois (local e remoto) têm dado de verdade. Cenário:
// aparelho A fica offline e cria um hábito (só existe no IndexedDB local,
// nunca chega no servidor); nesse meio-tempo, aparelho B (outra sessão,
// mesma conta) cria um hábito DIFERENTE e sincroniza normalmente. Quando A
// volta a ficar online e recarrega a página, loadForUser() lê local (só viu
// o hábito de A) e remoto (só viu o hábito de B) — sem merge, um dos dois
// seria descartado inteiro mesmo sem ter havido conflito de ESCRITA (A nem
// chegou a tentar escrever ainda).
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';
const PASSWORD = 'SenhaForte123!';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

async function signUpAndOnboard(page, name) {
  const email = `qa-loadmerge-${Date.now()}@example.com`;
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();
  await page.locator('input[type="text"]').first().fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').nth(0).fill(PASSWORD);
  await page.locator('input[type="password"]').nth(1).fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  const confirmScreen = page.getByText(/confirme seu e-mail|verifique seu e-mail/i);
  if (await confirmScreen.isVisible({ timeout: 4000 }).catch(() => false)) {
    throw new Error('Confirmação de e-mail está ativa — não dá pra testar cadastro automatizado. Teste manual necessário.');
  }

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
  return email;
}

async function signIn(page, email) {
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'Já tenho uma conta' }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const navEvoluir = page.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
  await expect(navEvoluir).toBeVisible({ timeout: 10000 });
}

async function goToMinhaBase(page) {
  const navEvoluir = page.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
  await clickTo(page, navEvoluir, page.getByText('Minha Base', { exact: true }));
  await clickTo(page, page.getByText('Minha Base', { exact: true }), page.getByRole('heading', { name: 'Minha Base' }));
}

async function createHabit(page, title) {
  await page.getByRole('button', { name: 'Novo hábito' }).click({ force: true });
  await page.locator('#modal-root input[type="text"]').first().fill(title);
  await page.locator('#modal-root').getByRole('button', { name: 'Criar hábito' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 5000 });
}

test.describe('Fase 0.3 (ponto 3) — merge no carregamento, não só na escrita', () => {
  test('A offline cria um hábito, B online cria outro, A volta e recarrega: nada some', async ({ browser }) => {
    test.setTimeout(90000);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const email = await signUpAndOnboard(pageA, 'QA LoadMerge A');

    // A fica offline ANTES de criar seu hábito — essa mudança nunca chega
    // no servidor enquanto A estiver offline.
    await contextA.setOffline(true);
    await goToMinhaBase(pageA);
    await createHabit(pageA, 'Hábito A (offline)');

    // B entra na mesma conta (só depois de A já estar offline) e cria um
    // hábito diferente, online — sincroniza normalmente. O servidor nunca
    // viu o hábito de A nesse ponto.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signIn(pageB, email);
    await goToMinhaBase(pageB);
    await createHabit(pageB, 'Hábito B (online)');
    await pageB.waitForTimeout(1000);

    // A volta a ficar online e recarrega — loadForUser() precisa mesclar o
    // que só existe localmente (Hábito A) com o que só existe no servidor
    // (Hábito B), não escolher um dos dois inteiro.
    await contextA.setOffline(false);
    await pageA.reload();
    await goToMinhaBase(pageA);
    await expect(pageA.getByText('Hábito A (offline)', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(pageA.getByText('Hábito B (online)', { exact: true })).toBeVisible({ timeout: 10000 });

    // Limpeza
    const navPerfil = pageA.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(pageA, navPerfil, pageA.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await pageA.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await pageA.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    await contextA.close();
    await contextB.close();
  });
});
