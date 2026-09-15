const { chromium } = require('playwright-core');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'https://mdhealthconsultoria.github.io/projeto-monstro';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const email = `syncdbg${Date.now()}@gmail.com`;
  const password = 'senha123';

  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page1 = await ctx1.newPage();
  const errors1 = [];
  page1.on('pageerror', e => errors1.push(`[pageerror] ${e.message}\n${e.stack}`));
  page1.on('console', m => { if (m.type() === 'error') errors1.push(`[console.error] ${m.text()}`); });

  await page1.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page1.waitForSelector('button:has-text("Criar conta")', { timeout: 15000 });
  await page1.click('button:has-text("Criar conta")');
  await page1.waitForSelector('#f-name-text', { timeout: 15000 });
  await page1.fill('#f-name-text', 'Sync Debug');
  await page1.fill('#f-nickname-text', 'Dbg');
  await page1.fill('#f-email-email', email);
  await page1.fill('#f-new-password-password >> nth=0', password);
  await page1.fill('#f-new-password-password >> nth=1', password);
  await page1.click('button[type="submit"]:has-text("Criar conta")');

  await page1.waitForSelector('.option-row', { timeout: 15000 });
  console.log('Step: goal options visible');
  await page1.click('.option-row:has-text("Força")');
  await page1.click('button:has-text("Continuar")');
  console.log('Step: clicked continue after goal. Body now:', (await page1.evaluate(() => document.body.innerText)).slice(0, 150).replace(/\n+/g,' | '));

  await page1.waitForSelector('button:has-text("Sim, começar hoje")', { timeout: 15000 });
  await page1.click('button:has-text("Sim, começar hoje")');
  console.log('Step: clicked Sim comecar hoje. Body now:', (await page1.evaluate(() => document.body.innerText)).slice(0, 150).replace(/\n+/g,' | '));
  await page1.waitForTimeout(300);
  await page1.click('button:has-text("Continuar")');
  console.log('Step: clicked continue after start-today. Body now:', (await page1.evaluate(() => document.body.innerText)).slice(0, 150).replace(/\n+/g,' | '));

  await page1.waitForSelector('input[type="time"]', { timeout: 15000 });
  console.log('Step: reminder time field visible');
  await page1.click('button:has-text("Continuar")');
  console.log('Step: clicked continue after reminder. Body now:', (await page1.evaluate(() => document.body.innerText)).slice(0, 150).replace(/\n+/g,' | '));

  await page1.waitForSelector('.option-row:has-text("Ambos")', { timeout: 15000 });
  console.log('Step: inspiration options visible');
  await page1.click('.option-row:has-text("Ambos")');
  await page1.click('button:has-text("Continuar")');
  console.log('Step: clicked continue after inspiration. Body now:', (await page1.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n+/g,' | '));

  await page1.waitForSelector('button:has-text("Concluir")', { timeout: 15000 });
  console.log('Step: first-goal screen visible (Concluir button present)');
  await page1.click('button:has-text("Concluir")');
  console.log('Step: clicked Concluir.');

  await page1.waitForTimeout(1500);
  console.log('Body after Concluir click + 1.5s wait:', (await page1.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n+/g,' | '));
  await page1.screenshot({ path: 'scripts/sync-debug-after-conclude.png' });

  console.log('\nErrors so far:', errors1.length ? errors1.join('\n---\n') : 'none');

  await browser.close();
})().catch(e => { console.error('DEBUG SCRIPT FAILED:', e); process.exit(1); });
