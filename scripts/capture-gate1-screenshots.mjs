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
  let context = null;
  let page = null;
  const results = [];

  const createFreshContext = async () => {
    if (context) await context.close();
    // Use fixed reducedMotion and deviceScaleFactor
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    page = await context.newPage();
  };

  const capture = async (name, setupFn) => {
    await createFreshContext();

    // Inject strict no-animation style
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      `;
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    });

    console.log(`Navigating for ${name}...`);
    await page.goto('http://127.0.0.1:4173/');
    await page.waitForSelector('[data-app-ready="true"]');
    await page.evaluate(() => document.fonts.ready);

    if (setupFn) {
      await setupFn(page);
    }

    const buf = await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    console.log(`Captured ${name} -> SHA256: ${sha}`);
    results.push({ name, sha });
  };

  try {
    // 1. Home / Course List
    await capture('home-course-list', async () => {});

    // 2. Chapter Player (PAUSED with subtitles on, forced poster state)
    await capture('chapter-player', async (p) => {
      await p.locator('button', { hasText: 'CPR & AED' }).first().click();
      await p.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button').click();
      const startCourse = p.locator('button', { hasText: 'START COURSE' }).first();
      await startCourse.waitFor({ state: 'visible' });
      await startCourse.click();

      const video = p.locator('video:not([src*="CPR-Dummies"]):not([src*="WakeUp"])').first();
      await video.waitFor({ state: 'attached' });

      // Ensure poster state determinism (currentTime = 0, paused)
      await video.evaluate((vid) => {
        vid.pause();
        vid.currentTime = 0;
      });
      // Enable subtitles if not already (assuming a CC button exists, or evaluating it)
      // The plan says "with subtitles on". Let's click CC button.
      const ccBtn = p.locator('button[title="Subtitles / Captions"]').first();
      if (await ccBtn.isVisible()) {
        const isOn = await ccBtn.evaluate(el => el.getAttribute('aria-pressed') === 'true' || el.classList.contains('text-primary'));
        if (!isOn) await ccBtn.click();
      }

      // Wait for controls to settle
      await p.locator('button[title="Play Narration"]').first().waitFor({ state: 'visible' });
    });

    // 3. Slideshow Slide
    await capture('slideshow-slide', async (p) => {
      await p.locator('button', { hasText: 'CPR & AED' }).first().click();
      const startCourse = p.locator('button', { hasText: 'START COURSE' }).first();
      await startCourse.waitFor({ state: 'visible' });
      await startCourse.click();
      
      // Wait for slideshow image or content to appear
      await p.waitForSelector('img, video', { state: 'visible' });
      // Force any video to poster state
      await p.evaluate(() => {
        document.querySelectorAll('video').forEach(vid => {
          vid.pause();
          vid.currentTime = 0;
        });
      });
    });

    // 4. Manual Page
    await capture('manual-page', async (p) => {
      // Click TRAINING MANUALS tab
      await p.locator('button', { hasText: 'TRAINING MANUALS' }).first().click();
      
      // Select the Student Manual
      await p.locator('button', { hasText: 'Student Manual' }).first().click();
      
      // Click OPEN STUDENT MANUAL
      await p.locator('button', { hasText: 'OPEN STUDENT MANUAL' }).first().click();

      // Wait for flipbook UI shell to mount
      await p.waitForSelector('text=Manual Flipbook Reader', { state: 'visible' });
    });

    // 5. Send Certs
    await capture('send-certs', async (p) => {
      await p.locator('button', { hasText: 'SEND CERTS' }).first().click();
      await p.waitForSelector('text=Secure Login', { state: 'visible' });
    });

    // 6. How-To
    await capture('how-to', async (p) => {
      // Navigate to Send Certs tab first
      await p.locator('button', { hasText: 'SEND CERTS' }).first().click();
      await p.waitForSelector('text=Secure Login', { state: 'visible' });

      // Click the Guide button in the Send Certs page
      const guideBtn = p.locator('button', { hasText: 'Step-by-Step Roster Guide' }).first();
      await guideBtn.waitFor({ state: 'visible' });
      await guideBtn.click();
      await p.waitForSelector('text=EH Academy Training Guides', { state: 'visible' });
    });

    // 7. Offline Modal
    await capture('offline-modal', async (p) => {
      // Find the settings cog or offline info button
      // Assuming it's in the sidebar settings area
      await p.locator('button', { hasText: 'SETTINGS' }).first().click();
      
      const offlineBtn = p.locator('span', { hasText: 'Offline Training Mode' }).locator('..').locator('button').first();
      await offlineBtn.waitFor({ state: 'visible' });
      await offlineBtn.click();
      await p.waitForSelector('text="Offline Training Mode"', { state: 'visible' });
    });

    // 8. Coming-Soon gate
    await capture('coming-soon', async (p) => {
      // Click CPR & AED tab
      await p.locator('button', { hasText: 'CPR & AED' }).first().click();
      
      // Toggle Pediatric to ON
      const pediatricToggle = p.locator('span', { hasText: 'Pediatric Focused?' }).locator('..').locator('button').first();
      await pediatricToggle.waitFor({ state: 'visible' });
      await pediatricToggle.click();
      await p.waitForTimeout(500);

      // Toggle Virtual Assistant to ON
      const vaToggle = p.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button').first();
      await vaToggle.waitFor({ state: 'visible' });
      await vaToggle.click();
      await p.waitForTimeout(500);

      const comingSoonBtn = p.locator('button', { hasText: 'COMING SOON' }).first();
      await comingSoonBtn.waitFor({ state: 'visible' });
      await comingSoonBtn.click();

      await p.waitForSelector('text="Coming Soon"', { state: 'visible' });
    });

    console.log('\n--- GATE 1 REFERENCE CHECKSUMS ---');
    results.forEach(r => console.log(`${r.name}.png: ${r.sha}`));
    console.log('----------------------------------\n');

  } catch (err) {
    console.error('Capture failed:', err);
    process.exit(1); // Exit NON-ZERO on failure
  } finally {
    if (browser) await browser.close();
  }
})();
