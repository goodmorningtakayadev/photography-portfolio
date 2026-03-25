/**
 * Build-time image optimization script.
 * Generates responsive WebP variants for all photos in photos.json.
 *
 * Usage: node scripts/optimize-images.js
 * Requires: sharp (npm install -D sharp)
 *
 * Output: public/photos/optimized/{id}-thumbnail.webp (400w)
 *         public/photos/optimized/{id}-display.webp   (1200w)
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PHOTOS_DIR = join(ROOT, 'public', 'photos');
const OUTPUT_DIR = join(PHOTOS_DIR, 'optimized');

const SIZES = {
  thumbnail: 400,
  display: 1200,
};

async function optimizeImages() {
  const data = JSON.parse(
    readFileSync(join(ROOT, 'src', 'data', 'photos.json'), 'utf-8')
  );

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Optimizing ${data.photos.length} photos...\n`);

  let success = 0;
  let failed = 0;

  for (const photo of data.photos) {
    const filename = photo.url.replace('/photos/', '');
    const sourcePath = join(PHOTOS_DIR, filename);

    if (!existsSync(sourcePath)) {
      console.warn(`  ⚠ Source not found: ${filename}`);
      failed++;
      continue;
    }

    for (const [sizeName, width] of Object.entries(SIZES)) {
      const outputPath = join(OUTPUT_DIR, `${photo.id}-${sizeName}.webp`);

      try {
        const info = await sharp(sourcePath)
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(outputPath);

        console.log(
          `  ✓ ${photo.id}-${sizeName}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)}KB`
        );
        success++;
      } catch (err) {
        console.error(`  ✗ ${photo.id}-${sizeName}.webp — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${success} generated, ${failed} failed.`);

  if (failed > 0) {
    process.exit(1);
  }
}

optimizeImages();
