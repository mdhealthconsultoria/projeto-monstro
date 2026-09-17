// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8790';

async function clickTo(page, clickLocator, expectLocator) {
  await expect(async () => {
    await clickLocator.click({ force: true });
    await expect(expectLocator).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 25000, intervals: [300, 500, 1000] });
}

// 1x1 PNG transparente, só pra ter um arquivo de imagem real pro upload.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

test.describe('Onda 6 — Fotos de evolução na nuvem (melhor esforço)', () => {
  test('cadastro -> registrar foto -> aparece -> remover -> sem erros mesmo sem bucket configurado', async ({ page }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    const email = `qa-wave6-${Date.now()}@example.com`;
    const password = 'SenhaForte123!';

    await page.goto(BASE_URL);

    // Desregistra qualquer service worker já ativo de uma execução de teste
    // anterior neste mesmo perfil de navegador local, e limpa caches — sem
    // isso um SW antigo pode interceptar fetch() e servir JS desatualizado.
    await page.evaluate(async () => {
      if (!navigator.serviceWorker) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    });
    await page.reload();
    await page.getByRole('button', { name: 'COMEÇAR MINHA EVOLUÇÃO' }).click();

    await page.locator('input[type="text"]').first().fill('QA Wave6');
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

    const navProgresso = page.getByRole('navigation').getByRole('button', { name: 'Progresso' });
    await expect(navProgresso).toBeVisible({ timeout: 10000 });
    await clickTo(page, navProgresso, page.getByRole('button', { name: 'Fotos' }));
    await clickTo(page, page.getByRole('button', { name: 'Fotos' }), page.getByText('REGISTRAR FOTOS'));

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'foto.png', mimeType: 'image/png', buffer: TINY_PNG,
    });
    await expect(page.getByRole('button', { name: 'Remover foto' }).first()).toBeVisible({ timeout: 10000 });

    // Dá um tempo pro upload/download "melhor esforço" pra nuvem rodar (deve
    // falhar em silêncio, já que o bucket ainda não existe neste Supabase).
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Remover foto' }).first().click();
    await page.locator('#modal-root').getByRole('button', { name: 'Apagar' }).click();
    await expect(page.getByRole('button', { name: 'Remover foto' })).toHaveCount(0);

    // Limpeza
    const navPerfil = page.getByRole('navigation').getByRole('button', { name: 'Perfil' });
    await clickTo(page, navPerfil, page.locator('#view').getByRole('button', { name: 'Excluir conta' }));
    await page.locator('#view').getByRole('button', { name: 'Excluir conta' }).click();
    await page.locator('#modal-root').getByRole('button', { name: 'Excluir conta' }).click();

    // "Bucket not found" é o comportamento ESPERADO e documentado até a
    // migration 0007 ser rodada — o app deve continuar funcionando (e
    // funcionou, o teste chegou até aqui), só registrando isso no console.
    const realErrors = errors.filter(e => !/ResizeObserver|Failed to sync|Failed to load resource|Falha ao (sincronizar|remover) foto/i.test(e));
    expect(realErrors, `Console/page errors: ${realErrors.join('\n')}`).toEqual([]);
  });
});
