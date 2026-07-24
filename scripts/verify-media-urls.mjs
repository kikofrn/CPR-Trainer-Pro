import fs from 'fs';
import https from 'https';
import { resolve } from 'path';

// Uses the scratch/update_chapters.mjs to get the manifest
const manifestPath = new URL('../../scratch/update_chapters.mjs', import.meta.url).pathname;

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.request(url, { method: 'HEAD' }, (res) => {
      resolve(res.statusCode);
    }).on('error', () => resolve(0)).end();
  });
}

async function run() {
  const { COURSES, SLIDESHOWS } = await import(manifestPath);
  let urls = [];
  const addUrl = (path) => {
    if (!path.startsWith('/')) {
        urls.push(`https://pub-2fdbdbfb56a84c81a2db54e8ff6d45f4.r2.dev/${path.split('/').map(encodeURIComponent).join('/')}`);
    } else {
        urls.push(`https://pub-2fdbdbfb56a84c81a2db54e8ff6d45f4.r2.dev${path.split('/').map(encodeURIComponent).join('/')}`);
    }
  };

  for (const c of COURSES) {
    if (c.videos) {
      c.videos.forEach(v => addUrl(v.filename));
    }
  }
  for (const s of SLIDESHOWS) {
    s.slides.forEach(slide => addUrl(slide.filename));
  }

  console.log(`Checking ${urls.length} URLs...`);
  let fails = 0;
  for (let i = 0; i < urls.length; i++) {
    const status = await checkUrl(urls[i]);
    if (status !== 200) {
      console.log(`[FAIL ${status}] ${urls[i]}`);
      fails++;
    }
    if (i % 50 === 0 && i > 0) console.log(`Checked ${i}/${urls.length}`);
  }
  console.log(`Done. ${fails} failures.`);
}

run().catch(console.error);
