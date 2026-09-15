const { chromium } = require('playwright-core');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'https://mdhealthconsultoria.github.io/projeto-monstro';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const email = `trace${Date.now()}@gmail.com`;
  const password = 'senha123';

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('button:has-text("Criar conta")', { timeout: 15000 });
  await page.click('button:has-text("Criar conta")');
  await page.waitForSelector('#f-name-text', { timeout: 15000 });
  await page.fill('#f-name-text', 'Trace Teste');
  await page.fill('#f-nickname-text', 'Tracer');
  await page.fill('#f-email-email', email);
  await page.fill('#f-new-password-password >> nth=0', password);
  await page.fill('#f-new-password-password >> nth=1', password);
  await page.click('button[type="submit"]:has-text("Criar conta")');

  await page.waitForSelector('.option-row', { timeout: 15000 });
  await page.click('.option-row:has-text("Força")');
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('button:has-text("Sim, começar hoje")', { timeout: 15000 });
  await page.click('button:has-text("Sim, começar hoje")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('input[type="time"]', { timeout: 15000 });
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('.option-row:has-text("Ambos")', { timeout: 15000 });
  await page.click('.option-row:has-text("Ambos")');
  await page.click('button:has-text("Continuar")');
  await page.waitForSelector('button:has-text("Concluir")', { timeout: 15000 });

  logs.push('=== CLICKING CONCLUIR ===');
  await page.click('button:has-text("Concluir")');
  await page.waitForTimeout(3500);
  logs.push('=== 3.5s AFTER CONCLUIR ===');

  console.log(logs.join('\n'));
  await browser.close();
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
