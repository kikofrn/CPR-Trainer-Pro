import { chromium } from 'playwright';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

(async () => {
  const outDir = path.resolve('gate-1-screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Helper to wait for load and capture
  const capture = async (name, width, height, setupFn) => {
    await page.setViewportSize({ width, height });
    
    // Disable animations
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `* { animation: none !important; transition: none !important; }`;
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    });

    console.log(`Navigating for ${name}...`);
    await page.goto('http://127.0.0.1:4173/');
    await page.waitForSelector('[data-app-ready="true"]');
    await page.evaluate(() => document.fonts.ready);

    if (setupFn) {
      await setupFn();
    }

    // small delay to let react settle
    await page.waitForTimeout(1000);

    const buf = await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    console.log(`Captured ${name} -> SHA256: ${sha}`);
    return { name, sha };
  };

  const results = [];

  try {
    // 1. Desktop boot
    results.push(await capture('boot-1440', 1440, 900));

    // 2. Mobile boot
    results.push(await capture('boot-390', 390, 844));

    // 3. CPR Course
    results.push(await capture('course-cpr-1440', 1440, 900, async () => {
      await page.locator('button', { hasText: 'CPR & AED' }).first().click();
      await page.waitForTimeout(500);
      await page.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button').click();
      await page.waitForTimeout(500);
      await page.locator('button', { hasText: 'START COURSE' }).first().click();
      await page.waitForSelector('video');
      await page.evaluate(() => {
        const v = document.querySelector('video');
        if (v) v.pause();
      });
    }));

    console.log('\n--- GATE 1 REFERENCE CHECKSUMS ---');
    results.forEach(r => console.log(`${r.name}.png: ${r.sha}`));
    console.log('----------------------------------\n');

  } catch (err) {
    console.error('Capture failed:', err);
  } finally {
    await browser.close();
  }
})();
