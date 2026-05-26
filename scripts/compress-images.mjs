import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

// Files to convert to WebP (large PNGs only)
const filesToConvert = [
  'CPR AED for All Ages Cover.png',
  'CPR AED for All Ages with VA.png',
  'First Aid for All Ages Cover.png',
  'First Aid for All Ages with VA.png',
  'Pediatric First Aid Cover.png',
  'manual-student-thumb.png',
  'manual-pediatric-thumb.png',
  'manual-instructor-thumb.png',
];

async function convertImages() {
  let totalSaved = 0;

  for (const file of filesToConvert) {
    const inputPath = path.join(publicDir, file);
    const outputPath = path.join(publicDir, file.replace('.png', '.webp'));

    if (!fs.existsSync(inputPath)) {
      console.log(`SKIP: ${file} not found`);
      continue;
    }

    const inputStats = fs.statSync(inputPath);
    const inputMB = (inputStats.size / 1024 / 1024).toFixed(2);

    await sharp(inputPath)
      .webp({ quality: 85 })
      .toFile(outputPath);

    const outputStats = fs.statSync(outputPath);
    const outputMB = (outputStats.size / 1024 / 1024).toFixed(2);
    const saved = inputStats.size - outputStats.size;
    totalSaved += saved;

    console.log(`✅ ${file}: ${inputMB} MB → ${outputMB} MB (saved ${(saved / 1024 / 1024).toFixed(2)} MB)`);

    // Remove the original PNG after successful conversion
    fs.unlinkSync(inputPath);
    console.log(`   🗑️  Removed original: ${file}`);
  }

  console.log(`\n🎉 Total saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
}

convertImages().catch(console.error);
