// @ts-check
// Fase 0.3 (ponto 5 da revisão 2) — "Apagar todos os dados" (store.resetAll)
// precisa sobreviver a um outro aparelho com cache antigo sincronizando
// depois. Sem o resetAt, o merge (ou até a leitura simples em loadForUser)
// trataria o cache velho de B como "dado de verdade" e traria tudo de volta.
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
  const email = `qa-reset-${Date.now()}@example.com`;
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

async function createHabit(page, title) {
  const navEvoluir = page.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
  await clickTo(page, navEvoluir, page.getByText('Minha Base', { exact: true }));
  await clickTo(page, page.getByText('Minha Base', { exact: true }), page.getByRole('heading', { name: 'Minha Base' }));
  await page.getByRole('button', { name: 'Novo hábito' }).click({ force: true });
  await page.locator('#modal-root input[type="text"]').first().fill(title);
  await page.locator('#modal-root').getByRole('button', { name: 'Criar hábito' }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 5000 });
}

test.describe('Fase 0.3 (ponto 5, revisão 2) — reset explícito sobrevive a cache antigo de outro aparelho', () => {
  test('A reseta, B abre com cache antigo depois: o hábito apagado não volta', async ({ browser }) => {
    test.setTimeout(90000);

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const email = await signUpAndOnboard(pageA, 'QA Reset A');
    await createHabit(pageA, 'Hábito antes do reset');

    // B entra DEPOIS do hábito existir — o load normal de B já traz esse
    // hábito pro cache local dele (isso é esperado e correto até aqui).
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await signIn(pageB, email);
    const navEvoluirB = pageB.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
    await clickTo(pageB, navEvoluirB, pageB.getByText('Minha Base', { exact: true }));
    await clickTo(pageB, pageB.getByText('Minha Base', { exact: true }), pageB.getByRole('heading', { name: 'Minha Base' }));
    await expect(pageB.getByText('Hábito antes do reset', { exact: true })).toBeVisible({ timeout: 10000 });

    // A apaga tudo.
    const navPerfilA = pageA.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(pageA, navPerfilA, pageA.getByText('Apagar todos os dados'));
    await pageA.getByText('Apagar todos os dados').click({ force: true });
    await pageA.locator('#modal-root').getByRole('button', { name: 'Apagar tudo' }).click();
    await expect(pageA.getByText('Todos os dados foram apagados')).toBeVisible({ timeout: 10000 });

    // BLOQUEADOR (revisão 3): B ainda não recarregou (não sabe do reset) e
    // toca no hábito AGORA — isso avança o lastModifiedAt de B pra DEPOIS
    // do reset de A, mesmo sem B conhecer o resetAt de A. Se o merge
    // comparasse resetAt com lastModifiedAt (bug antigo), esse único toque
    // seria suficiente pra ressuscitar tudo quando B sincronizasse.
    await pageB.getByRole('button', { name: 'Marcar hoje' }).click({ force: true });
    await pageB.waitForTimeout(2000); // dá tempo do mutate() de B colidir em revisão e cair no merge sozinho

    // B recarrega — loadForUser() tem que descartar o cache antigo de B
    // inteiro (resetAt de A vence), não mesclar o hábito apagado de volta.
    await pageB.reload();
    const navEvoluirB2 = pageB.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
    await clickTo(pageB, navEvoluirB2, pageB.getByText('Minha Base', { exact: true }));
    await clickTo(pageB, pageB.getByText('Minha Base', { exact: true }), pageB.getByRole('heading', { name: 'Minha Base' }));
    await expect(pageB.getByText('Hábito antes do reset', { exact: true })).not.toBeVisible();
    await expect(pageB.getByText('Nenhum hábito ainda')).toBeVisible({ timeout: 10000 });

    // Limpeza (a conta já não tem hábitos — só precisa excluir a conta).
    const navPerfilB = pageB.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(pageB, navPerfilB, pageB.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await pageB.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await pageB.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    await contextA.close();
    await contextB.close();
  });
});
