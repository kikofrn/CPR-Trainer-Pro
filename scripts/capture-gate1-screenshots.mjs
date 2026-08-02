import { chromium } from 'playwright';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

(async () => {
  const outDir = path.resolve('gate-1-screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch();
  let context = null;
  let page = null;

  let unexpectedErrors = 0;

  const createFreshContext = async () => {
    if (context) await context.close();
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      colorScheme: 'light'
    });
    page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Unexpected console.error:', msg.text());
        unexpectedErrors++;
      }
    });
    page.on('pageerror', err => {
      console.error('Unexpected pageerror:', err.message);
      unexpectedErrors++;
    });
    await page.addInitScript(() => {
      window.addEventListener('unhandledrejection', event => {
        console.error('Unhandled Rejection:', event.reason);
      });
    });
  };

  const capture = async (name, passName, setupFn) => {
    await createFreshContext();

    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      `;
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
      window.MotionGlobalConfig = { skipAnimations: true };
    });

    console.log(`[${passName}] Navigating for ${name}...`);
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-app-ready="true"]');
    await page.evaluate(() => document.fonts.ready);

    if (setupFn) {
      await setupFn(page);
    }

    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => i.offsetParent !== null);
      return imgs.length > 0 ? imgs.every(img => img.complete && img.naturalHeight > 0) : true;
    }, { timeout: 30000 });

    // Wait for DOM to be idle for 500ms (catches Framer Motion entrance animations)
    await page.waitForFunction(() => {
      return new Promise(resolve => {
        let timeout = setTimeout(resolve, 500);
        const observer = new MutationObserver(() => {
          clearTimeout(timeout);
          timeout = setTimeout(resolve, 500);
        });
        observer.observe(document.body, { attributes: true, childList: true, subtree: true });
      });
    }, { timeout: 30000 }).catch(() => {});

    await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(img => img.offsetParent !== null);
      return Promise.all(imgs.map(img => img.decode().catch(() => {})));
    });

    await page.evaluate(() => {
      const vids = document.querySelectorAll('video');
      vids.forEach(vid => {
        vid.pause();
        vid.currentTime = 0;
      });
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    });

    await page.mouse.move(0, 0);

    const buf = await page.screenshot({ 
      path: path.join(outDir, `${passName}-${name}.png`),
      animations: 'disabled',
      caret: 'hide',
      mask: [page.locator('video'), page.locator('iframe'), page.locator('button[role="switch"]')]
    });
    return crypto.createHash('sha256').update(buf).digest('hex');
  };

  const surfaces = [
    {
      name: 'home-course-list',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'CPR & AED' }).first().waitFor({ state: 'visible' });
        await p.locator('img').first().waitFor({ state: 'visible' });
      }
    },
    {
      name: 'chapter-player',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'CPR & AED' }).first().click();
        await p.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button').click();
        const startCourse = p.locator('button', { hasText: 'START COURSE' }).first();
        await startCourse.waitFor({ state: 'visible' });
        await startCourse.click();

        const video = p.locator('video:not([src*="CPR-Dummies"]):not([src*="WakeUp"])').first();
        await video.waitFor({ state: 'attached' });

        const ccBtn = p.locator('button[title="Subtitles / Captions"]').first();
        if (await ccBtn.isVisible()) {
          const isOn = await ccBtn.evaluate(el => el.getAttribute('aria-pressed') === 'true' || el.classList.contains('text-primary'));
          if (!isOn) await ccBtn.click();
        }

        await p.locator('button[title="Play Narration"]').first().waitFor({ state: 'visible' });
      }
    },
    {
      name: 'slideshow-slide',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'CPR & AED' }).first().click();
        const startCourse = p.locator('button', { hasText: 'START COURSE' }).first();
        await startCourse.waitFor({ state: 'visible' });
        await startCourse.click();
        await p.waitForSelector('img, video', { state: 'visible' });
      }
    },
    {
      name: 'manual-page',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'TRAINING MANUALS' }).first().click();
        await p.locator('button', { hasText: 'Student Manual' }).first().click();
        await p.locator('button', { hasText: 'OPEN STUDENT MANUAL' }).first().click();
        await p.waitForSelector('text=Manual Flipbook Reader', { state: 'visible' });
        await p.waitForSelector('canvas, img', { state: 'visible' });
      }
    },
    {
      name: 'send-certs',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'SEND CERTS' }).first().click();
        await p.waitForSelector('text=Secure Login', { state: 'visible' });
      }
    },
    {
      name: 'how-to',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'SEND CERTS' }).first().click();
        await p.waitForSelector('text=Secure Login', { state: 'visible' });
        const guideBtn = p.locator('button', { hasText: 'Step-by-Step Roster Guide' }).first();
        await guideBtn.waitFor({ state: 'visible' });
        await guideBtn.click();
        await p.waitForSelector('text=EH Academy Training Guides', { state: 'visible' });
        await p.waitForSelector('iframe, video, img', { state: 'visible' });
      }
    },
    {
      name: 'offline-modal',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'SETTINGS' }).first().click();
        const offlineBtn = p.locator('span', { hasText: 'Offline Training Mode' }).locator('..').locator('button').first();
        await offlineBtn.waitFor({ state: 'visible' });
        await offlineBtn.click();
        await p.waitForSelector('text="Offline Training Mode"', { state: 'visible' });
      }
    },
    {
      name: 'coming-soon',
      setupFn: async (p) => {
        await p.locator('button', { hasText: 'CPR & AED' }).first().click();

        const pediatricToggle = p.locator('span', { hasText: 'Pediatric Focused?' }).locator('..').locator('button').first();
        await pediatricToggle.waitFor({ state: 'visible' });
        await pediatricToggle.click();

        await p.locator('span', { hasText: 'Enable Virtual Assistant?' }).waitFor({ state: 'visible' });

        const vaToggle = p.locator('span', { hasText: 'Enable Virtual Assistant?' }).locator('..').locator('button').first();
        await vaToggle.waitFor({ state: 'visible' });
        await vaToggle.click();

        const comingSoonBtn = p.locator('button', { hasText: 'COMING SOON' }).first();
        await comingSoonBtn.waitFor({ state: 'visible' });
      }
    }
  ];

  try {
    const resultsA = {};
    for (const surface of surfaces) {
      resultsA[surface.name] = await capture(surface.name, 'pass-A', surface.setupFn);
    }

    const resultsB = {};
    for (const surface of surfaces) {
      resultsB[surface.name] = await capture(surface.name, 'pass-B', surface.setupFn);
    }

    if (unexpectedErrors > 0) {
      console.error(`Failed with ${unexpectedErrors} unexpected browser errors.`);
      process.exit(1);
    }

    let diffCount = 0;
    for (const surface of surfaces) {
      if (resultsA[surface.name] !== resultsB[surface.name]) {
        console.error(`Hash mismatch for ${surface.name}`);
        console.error(`  Pass A: ${resultsA[surface.name]}`);
        console.error(`  Pass B: ${resultsB[surface.name]}`);
        diffCount++;
      }
    }

    if (diffCount > 0) {
      console.error(`Reproducibility failed: ${diffCount} image hashes did not match.`);
      process.exit(1);
    }

    const sha = execSync('git rev-parse HEAD').toString().trim();
    const playwrightVersionStr = execSync('npx playwright --version').toString().trim();

    const manifest = {
      candidateCodeSha: sha,
      environment: {
        os: process.platform,
        playwrightVersion: playwrightVersionStr,
        chromiumBuild: 'bundled',
        viewport: '1440x900',
        dpr: 1,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        colorScheme: 'light',
        videoPolicy: 'forced poster state (currentTime=0, paused)'
      },
      hashes: {
        passA: resultsA,
        passB: resultsB
      },
      unexpectedErrors: unexpectedErrors
    };

    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('Successfully generated reproducible screenshots and manifest.json.');

  } catch (err) {
    console.error('Capture failed:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
