import sharp from 'sharp';

async function main() {
  try {
    const inputImagePath = 'public/eha-icon.png';
    const outputImagePath = 'src-tauri/app-icon.png';
    
    // Get metadata to see dimensions
    const metadata = await sharp(inputImagePath).metadata();
    const size = Math.max(metadata.width, metadata.height);
    
    // Pad to square
    await sharp(inputImagePath)
      .resize({
        width: size,
        height: size,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFile(outputImagePath);
      
    console.log('Successfully squared the image!');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
