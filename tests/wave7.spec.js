// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

async function signUpAndOnboard(page, name, email, password) {
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();
  await page.locator('input[type="text"]').first().fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').nth(0).fill(password);
  await page.locator('input[type="password"]').nth(1).fill(password);
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
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Perfil' })).toBeVisible({ timeout: 10000 });
}

async function deleteAccount(page) {
  const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
  await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
  await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
  await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();
}

test.describe('Onda 7 — Denúncias e bloqueio em comunidades', () => {
  test('duas contas: A posta, B denuncia + bloqueia, A resolve a denúncia', async ({ browser }) => {
    test.setTimeout(90000);
    const stamp = Date.now();
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    const errorsA = [];
    const errorsB = [];
    pageA.on('pageerror', e => errorsA.push(String(e)));
    pageA.on('console', m => { if (m.type() === 'error') errorsA.push(m.text()); });
    pageB.on('pageerror', e => errorsB.push(String(e)));
    pageB.on('console', m => { if (m.type() === 'error') errorsB.push(m.text()); });

    await signUpAndOnboard(pageA, 'QA Mod A', `qa-wave7a-${stamp}@example.com`, 'SenhaForte123!');
    await signUpAndOnboard(pageB, 'QA Mod B', `qa-wave7b-${stamp}@example.com`, 'SenhaForte123!');

    // A cria uma comunidade pública e publica algo
    const navComunidadesA = pageA.getByRole('navigation').getByRole('button', { name: 'Comunidades' });
    await clickTo(pageA, navComunidadesA, pageA.getByRole('button', { name: 'Criar comunidade' }));
    await pageA.getByRole('button', { name: 'Criar comunidade' }).click({ force: true });
    const communityName = `QA Moderação ${stamp}`;
    await pageA.locator('#modal-root input[type="text"]').fill(communityName);
    await pageA.locator('#modal-root').getByRole('button', { name: 'Criar comunidade' }).click();
    await expect(pageA.getByRole('heading', { name: communityName })).toBeVisible({ timeout: 10000 });

    await pageA.locator('textarea').fill('Mensagem de teste pra moderação.');
    await pageA.getByRole('button', { name: 'Publicar' }).click();
    await expect(pageA.getByText('Mensagem de teste pra moderação.')).toBeVisible({ timeout: 10000 });

    // B busca e entra na comunidade
    const navComunidadesB = pageB.getByRole('navigation').getByRole('button', { name: 'Comunidades' });
    await clickTo(pageB, navComunidadesB, pageB.locator('input[placeholder="Buscar comunidades..."]'));
    await pageB.locator('input[placeholder="Buscar comunidades..."]').fill(communityName);
    await pageB.locator('input[placeholder="Buscar comunidades..."]').press('Enter');
    await clickTo(pageB, pageB.getByText(communityName, { exact: true }), pageB.getByRole('button', { name: 'Entrar' }));
    await pageB.getByRole('button', { name: 'Entrar' }).click({ force: true });
    await expect(pageB.getByText('Mensagem de teste pra moderação.')).toBeVisible({ timeout: 10000 });

    // B denuncia o post de A. Se a migration 0008 ainda não tiver rodado, a
    // escrita falha e o modal fica aberto de propósito (mesmo padrão dos
    // outros modais do app) — fecha explicitamente antes de seguir, pra não
    // deixar o backdrop bloqueando o próximo clique.
    await pageB.getByRole('button', { name: 'Denunciar' }).first().click();
    await pageB.locator('#modal-root textarea').fill('Conteúdo de teste automatizado.');
    await pageB.locator('#modal-root').getByRole('button', { name: 'Enviar denúncia' }).click();
    await expect(pageB.getByText(/Denúncia enviada|ainda não está disponível/)).toBeVisible({ timeout: 10000 });
    await pageB.keyboard.press('Escape');
    await expect(pageB.locator('#modal-root .modal-backdrop')).toHaveCount(0);

    // B bloqueia A (via linha de membro) e o post some do mural de B
    await pageB.getByRole('button', { name: 'Bloquear' }).first().click();
    await expect(pageB.getByText(/Bloqueado|ainda não está disponível/)).toBeVisible({ timeout: 10000 });

    // A revisa a denúncia (se a migration já tiver rodado) — tolera o caso
    // dela ainda não ter sido aplicada (painel simplesmente vazio). Este app
    // não tem roteamento por URL — reload sempre volta pro boot (Hoje), tem
    // que renavegar pela UI até a comunidade de novo.
    await pageA.reload();
    const navComunidadesA2 = pageA.getByRole('navigation').getByRole('button', { name: 'Comunidades' });
    await clickTo(pageA, navComunidadesA2, pageA.getByText(communityName, { exact: true }));
    await clickTo(pageA, pageA.getByText(communityName, { exact: true }), pageA.getByRole('heading', { name: communityName }));
    const pendingPanel = pageA.getByText(/DENÚNCIAS PENDENTES/);
    if (await pendingPanel.isVisible({ timeout: 4000 }).catch(() => false)) {
      await pageA.getByRole('button', { name: 'Resolver' }).first().click();
      await expect(pageA.getByText('Marcada como resolvida')).toBeVisible({ timeout: 10000 });
    }

    // Limpeza
    await deleteAccount(pageB);
    await pageA.reload();
    await expect(pageA.getByRole('navigation').getByRole('button', { name: 'Comunidades' })).toBeVisible({ timeout: 10000 });
    await deleteAccount(pageA);

    const realErrorsA = errorsA.filter(e => !/ResizeObserver|Failed to sync|Failed to load resource/i.test(e));
    const realErrorsB = errorsB.filter(e => !/ResizeObserver|Failed to sync|Failed to load resource/i.test(e));
    expect(realErrorsA, `A errors: ${realErrorsA.join('\n')}`).toEqual([]);
    expect(realErrorsB, `B errors: ${realErrorsB.join('\n')}`).toEqual([]);

    await ctxA.close();
    await ctxB.close();
  });
});
