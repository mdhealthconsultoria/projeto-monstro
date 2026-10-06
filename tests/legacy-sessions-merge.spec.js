// @ts-check
// Fase 0.3 (ponto 1 da revisão 2 do PR) — BLOQUEADOR: um usuário com
// sessões antigas (de antes de focus.sessions/breathing.sessions/
// knowledgeItem.sessions terem `id`) perdia TODO o histórico legado ao
// registrar uma sessão nova — o merge via união-por-id via qualquer item
// com id e descartava quem não tinha. js/migrateState.js dá id
// determinístico aos itens legados no load, e js/merge.js nunca mais
// descarta um item só por falta de id.
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

// Lê o dado real em vez de depender do texto renderizado — js/views/conhecimento.js
// tem um typo de plural pré-existente ("sessãoões" em vez de "sessões", não
// relacionado a este PR), e verificar a contagem de verdade é mais robusto
// de qualquer forma pra um teste de integridade de merge.
async function sessionCount(page) {
  return page.evaluate(async () => {
    const { store } = await import('/js/store.js');
    const itemId = Object.keys(store.state.knowledgeItems)[0];
    return store.state.knowledgeItems[itemId].sessions.length;
  });
}

test.describe('Fase 0.3 (ponto 1, revisão 2) — sessões legadas sem id sobrevivem ao merge', () => {
  test('estado legado sem ids, registra sessão nova, recarrega: nada some', async ({ page }) => {
    test.setTimeout(60000);

    const email = `qa-legacy-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();
    await page.locator('input[type="text"]').first().fill('QA Legacy');
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

    const navEvoluir = page.getByRole('navigation').getByRole('button', { name: 'Evoluir' });
    await expect(navEvoluir).toBeVisible({ timeout: 10000 });

    await clickTo(page, navEvoluir, page.getByText('Minha Evolução'));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Conhecimento', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Sistema de domínio'), page.getByRole('heading', { name: 'Conhecimento' }));

    await page.locator('input[type="text"]').fill('Inglês avançado');
    await page.getByRole('button', { name: 'Adicionar' }).click({ force: true });
    await expect(page.getByText('Inglês avançado')).toBeVisible();

    // Injeta 20 sessões LEGADAS (sem id — simula conta criada antes desta
    // correção existir) direto no state, sincroniza igual o app faria.
    await page.evaluate(async () => {
      const { store } = await import('/js/store.js');
      const { saveState } = await import('/js/db.js');
      const itemId = Object.keys(store.state.knowledgeItems)[0];
      const legacySessions = Array.from({ length: 20 }, (_, i) => ({
        date: new Date(2026, 0, i + 1, 8, 0, 0).toISOString(),
        minutes: 10 + i,
      }));
      store.state.knowledgeItems[itemId].sessions = legacySessions;
      store.state.lastModifiedAt = new Date().toISOString();
      await saveState(store.userId, store.state);
      await store.pushToCloud();
    });
    await page.reload();
    await clickTo(page, navEvoluir, page.getByText('Minha Evolução'));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Conhecimento', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Sistema de domínio'), page.getByRole('heading', { name: 'Conhecimento' }));
    await expect.poll(() => sessionCount(page), { timeout: 10000 }).toBe(20);

    // Registra UMA sessão nova pela UI (essa já nasce com id) — é esse
    // misto (20 sem id + 1 com id) que disparava o bug.
    const card = page.locator('.knowledge-item').first();
    await card.locator('input[type="number"]').fill('45');
    await expect(async () => {
      await card.getByRole('button', { name: 'Registrar sessão' }).click({ force: true });
      expect(await sessionCount(page)).toBe(21);
    }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });

    // Recarrega — loadForUser() funde local x remoto. Nada pode sumir.
    await page.reload();
    await clickTo(page, navEvoluir, page.getByText('Minha Evolução'));
    await clickTo(page, page.getByText('Minha Evolução'), page.getByRole('heading', { name: 'Minha Evolução' }));
    await clickTo(page, page.getByText('Conhecimento', { exact: true }), page.getByText('PONTUAÇÃO DA ÁREA'));
    await clickTo(page, page.getByText('Sistema de domínio'), page.getByRole('heading', { name: 'Conhecimento' }));
    await expect.poll(() => sessionCount(page), { timeout: 10000 }).toBe(21);

    // Limpeza
    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();
  });
});
