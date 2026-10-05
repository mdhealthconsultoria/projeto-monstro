// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

// Views fully remount their DOM on every store update (no vdom diffing), and
// a click that also triggers a store.mutate() (e.g. activating an area) can
// land in the same instant as that redraw. A real tap doesn't care — it's a
// trusted OS input event fired at a screen position, not a script waiting
// for "stability" — so `force: true` matches that, and the retry loop is a
// safety net on top for the rare genuinely-missed click.
async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

test.describe('Minha Evolução (áreas da vida)', () => {
  test('cadastro -> ativar área -> adicionar hábito da biblioteca -> check-in -> score sobe', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-areas-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Areas');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').nth(0).fill(password);
    await page.locator('input[type="password"]').nth(1).fill(password);
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // Se confirmação de e-mail estiver ativa, a tela vai travar aqui — não dá
    // pra continuar automatizado. Detecta isso cedo e reporta com clareza.
    const confirmScreen = page.getByText(/confirme seu e-mail|verifique seu e-mail/i);
    if (await confirmScreen.isVisible({ timeout: 4000 }).catch(() => false)) {
      throw new Error('Confirmação de e-mail está ativa — não dá pra testar cadastro automatizado. Teste manual necessário.');
    }

    // Onboarding: objetivo -> começar hoje? -> lembrete -> mensagem -> meta.
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
    await expect(page.getByText('MONTRO SCORE')).toBeVisible();

    // 6 áreas visíveis
    for (const label of ['Mente', 'Físico', 'Saúde', 'Profissional', 'Conhecimento', 'Social']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Entra em Físico
    await clickTo(page, page.getByText('Físico', { exact: true }), page.getByRole('heading', { name: 'Físico' }));
    await expect(page.getByText('PONTUAÇÃO DA ÁREA')).toBeVisible();
    await expect(page.getByText('Área ativa (conta pro Montro Score)').locator('..').getByRole('button', { name: 'Ativa' })).toBeVisible();

    // Biblioteca com evidência visível, adiciona "Caminhar 30 minutos"
    await expect(page.getByText('BIBLIOTECA DE HÁBITOS COM EVIDÊNCIA')).toBeVisible();
    const walkCard = page.locator('.library-item', { hasText: 'Caminhar 30 minutos' });
    await expect(walkCard).toBeVisible();
    await expect(walkCard.getByText('Evidência forte')).toBeVisible();
    await walkCard.getByRole('button', { name: 'Adicionar aos meus hábitos' }).click();
    await expect(walkCard.getByText('Já nos seus hábitos')).toBeVisible();

    // Agora aparece em "seus hábitos" com botão de check-in
    const habitRow = page.locator('.habit-row', { hasText: 'Caminhar 30 minutos' });
    await expect(habitRow).toBeVisible();
    await habitRow.locator('.check-toggle').click();
    await expect(habitRow.locator('.check-toggle.checked')).toBeVisible();

    // Score da área não é mais "—"
    const scoreNum = page.locator('.montro-hero-num').first();
    await expect(scoreNum).not.toHaveText('—');

    // Volta pro overview e confere que o Montro Score também não é mais 0 (com 1 hábito marcado, sobe do zero)
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByRole('heading', { name: 'Minha Evolução' }));
    const montroNum = page.locator('.montro-hero-num').first();
    const montroText = await montroNum.textContent();
    expect(Number(montroText)).toBeGreaterThan(0);

    // Limpeza: apaga a conta de teste pra não poluir dados reais.
    await clickTo(page, page.getByRole('button', { name: 'Voltar' }), page.getByText('Minha Evolução'));
    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
