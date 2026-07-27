import https from 'https';

const manifestPath = new URL('../src/chapters.ts', import.meta.url).pathname;

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Range': 'bytes=0-0'
      } 
    }, (res) => {
      // Must consume response data to free up memory
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    }).on('error', (err) => {
      console.error(err);
      resolve(0);
    });
  });
}

async function run() {
  const { COURSES, SLIDESHOWS, MANUALS } = await import(manifestPath);
  
  let urlsAndFiles = [];
  
  const addUrl = (path) => {
    if (!path || !path.trim()) return;
    const clean = path.startsWith('/') ? path.slice(1) : path;
    const encoded = clean.split('/').map(s => encodeURIComponent(s)).join('/');
    urlsAndFiles.push({
      file: path,
      url: `https://media.ehacademy.com/${encoded}`
    });
  };

  for (const c of COURSES) {
    if (c.isComingSoon) continue;
    if (c.chapters) {
      c.chapters.forEach(v => addUrl(v.filename));
    }
  }
  for (const s of SLIDESHOWS) {
    if (s.isComingSoon) continue;
    if (s.slides) {
      s.slides.forEach(slide => addUrl(slide.filename));
    }
  }
  for (const m of MANUALS) {
    if (m.isComingSoon) continue;
    if (m.filename) addUrl(m.filename);
  }

  // Deduplicate
  const seen = new Set();
  urlsAndFiles = urlsAndFiles.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  console.log(`Checking ${urlsAndFiles.length} URLs...`);
  
  let fails = 0;
  // Run checks in chunks to avoid maxing out sockets
  const chunkSize = 20;
  for (let i = 0; i < urlsAndFiles.length; i += chunkSize) {
    const chunk = urlsAndFiles.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(async (item) => {
      const status = await checkUrl(item.url);
      return { ...item, status };
    }));
    
    for (const res of results) {
      if (res.status !== 200 && res.status !== 206) {
        console.log(`[FAIL ${res.status}] ${res.file}`);
        fails++;
      }
    }
    
    if (i > 0 && i % 100 === 0) console.log(`Checked ${i}/${urlsAndFiles.length}`);
  }
  
  console.log(`Done. ${fails} failures.`);
  if (fails > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
