// @ts-check
// Fase 0.3 — controle de concorrência otimista em user_app_state. Simula
// dois aparelhos na MESMA conta: um fica offline e grava um hábito, o outro
// (online) grava outro hábito diferente nesse meio-tempo. Quando o aparelho
// offline volta, a escrita dele colide em revisão com o que já está na nuvem
// — o fix precisa buscar o remoto, fazer merge e gravar os dois hábitos,
// sem que nenhum dos dois se perca.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';
const PASSWORD = 'SenhaForte123!';
const SUPABASE_URL = 'https://jqrehtqwkeoiredbvjiy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yzFoPawxLGImEQMNghzQSg_yprxxoB3';

// Esse teste só consegue validar o merge de verdade depois que a migration
// 0010 (coluna `revision`) for aplicada em produção — até lá, o app usa o
// fallback antigo (upsert cego, sem merge), que é um comportamento JÁ
// conhecido e não é isso que este teste quer provar. Em vez de falhar com um
// erro confuso, pula com uma mensagem clara.
async function revisionColumnExists() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_app_state?select=revision&limit=0`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (res.ok) return true;
  const body = await res.json().catch(() => ({}));
  // SELECT com coluna inexistente: 42703 (erro nativo do Postgres), não
  // PGRST204 (esse é só pra INSERT/UPDATE) — ver mesmo comentário em store.js.
  if (body && (body.code === 'PGRST204' || body.code === '42703')) return false;
  return true; // outro tipo de erro (rede etc.) — deixa o teste rodar e falhar com detalhe de verdade
}

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

async function signUpAndOnboard(page, name) {
  const email = `qa-sync-${Date.now()}@example.com`;
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

test.describe('Fase 0.3 — merge de conflito entre dois aparelhos', () => {
  test('hábito criado offline não apaga o hábito criado em outro aparelho', async ({ browser }) => {
    test.setTimeout(90000);

    if (!(await revisionColumnExists())) {
      test.skip(true, 'Migration 0010 (coluna revision) ainda não foi aplicada em produção — ver supabase/migrations/0010_user_app_state_revision.sql.');
    }

    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const email = await signUpAndOnboard(page1, 'QA Sync Device1');

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await signIn(page2, email);

    // A partir daqui, device2 fica offline — qualquer escrita dele só
    // alcança o IndexedDB local, nunca a nuvem, até voltar online.
    await context2.setOffline(true);

    await goToMinhaBase(page1);
    await createHabit(page1, 'Hábito Device1');
    // Dá tempo do pushToCloud() do device1 assentar antes do device2 voltar.
    await page1.waitForTimeout(1500);

    await goToMinhaBase(page2);
    await createHabit(page2, 'Hábito Device2');

    // Device2 volta a ficar online — dispara o listener 'online' do store,
    // que tenta sincronizar, colide em revisão, busca o remoto, faz merge
    // (js/merge.js) e grava os dois hábitos.
    await context2.setOffline(false);
    await page2.waitForTimeout(3000);

    // Confere no device1 (recarregando do zero, forçando uma leitura real da
    // nuvem) que nenhum dos dois hábitos foi perdido.
    await page1.reload();
    await goToMinhaBase(page1);
    await expect(page1.getByText('Hábito Device1', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page1.getByText('Hábito Device2', { exact: true })).toBeVisible({ timeout: 10000 });

    // Limpeza
    const navPerfil = page1.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page1, navPerfil, page1.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page1.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page1.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    await context1.close();
    await context2.close();
  });
});
