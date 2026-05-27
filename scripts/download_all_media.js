import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://media.ehacademy.com/';
const TARGET_DIR = path.resolve(__dirname, '../public/media');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// Read chapters.ts to extract all filenames
const chaptersPath = path.resolve(__dirname, '../src/chapters.ts');
const chaptersContent = fs.readFileSync(chaptersPath, 'utf-8');

// Regex to find all filename properties
const filenameRegex = /filename:\s*["']([^"']+)["']/g;
const filesToDownload = new Set();

let match;
while ((match = filenameRegex.exec(chaptersContent)) !== null) {
  let filename = match[1].trim();
  if (filename.startsWith('/')) {
    filename = filename.slice(1);
  }
  if (filename) {
    filesToDownload.add(filename);
  }
}

const fileList = Array.from(filesToDownload);
console.log(`Found ${fileList.length} unique media files to download.`);

async function downloadFile(filename) {
  const fileUrl = BASE_URL + encodeURIComponent(filename);
  const targetPath = path.resolve(TARGET_DIR, filename);
  
  // Skip if already exists and has size
  if (fs.existsSync(targetPath)) {
    const stats = fs.statSync(targetPath);
    if (stats.size > 0) {
      console.log(`[SKIP] Already exists: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return;
    }
  }

  console.log(`[START] Downloading: ${filename}`);

  return new Promise((resolve, reject) => {
    https.get(fileUrl, (response) => {
      if (response.statusCode === 200) {
        const fileStream = fs.createWriteStream(targetPath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`[DONE] ${filename}`);
          resolve();
        });
        
        fileStream.on('error', (err) => {
          fs.unlinkSync(targetPath);
          console.error(`[ERROR] File write error for ${filename}:`, err);
          reject(err);
        });
      } else {
        console.error(`[ERROR] Download failed for ${filename}. Status: ${response.statusCode}`);
        reject(new Error(`Status: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      console.error(`[ERROR] Network error for ${filename}:`, err);
      reject(err);
    });
  });
}

// Download sequentially to avoid overwhelming the server/connection
async function downloadAll() {
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < fileList.length; i++) {
    console.log(`\n--- Progress: ${i + 1}/${fileList.length} ---`);
    try {
      await downloadFile(fileList[i]);
      successCount++;
    } catch (e) {
      failCount++;
    }
  }
  
  console.log('\n=====================================');
  console.log(`DOWNLOAD COMPLETE. Success: ${successCount}, Failed: ${failCount}`);
  console.log('=====================================');
}

downloadAll();
