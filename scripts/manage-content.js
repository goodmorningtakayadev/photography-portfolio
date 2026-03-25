/**
 * Content management CLI for photography portfolio.
 * Add photos, manage collections, toggle draft/publish state.
 *
 * Usage:
 *   node scripts/manage-content.js add-photo
 *   node scripts/manage-content.js add-collection
 *   node scripts/manage-content.js manage
 */

import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync, renameSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PHOTOS_JSON = join(ROOT, 'src', 'data', 'photos.json');
const PHOTOS_DIR = join(ROOT, 'public', 'photos');
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

// ─── Helpers ────────────────────────────────────────────

function loadData() {
  return JSON.parse(readFileSync(PHOTOS_JSON, 'utf-8'));
}

function safeWriteData(data) {
  const tmpPath = PHOTOS_JSON + '.tmp';
  try {
    writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    renameSync(tmpPath, PHOTOS_JSON);
  } catch (err) {
    // Clean up temp file if rename failed
    if (existsSync(tmpPath)) {
      try { unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    }
    throw err;
  }
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/\.\.\//g, '')    // strip path traversal
    .replace(/\.\//g, '')      // strip relative paths
    .replace(/\s+/g, '-')      // spaces → hyphens
    .replace(/[^a-z0-9\-.]/g, '') // keep only safe chars
    .replace(/-+/g, '-')       // collapse multiple hyphens
    .replace(/^-|-$/g, '');    // trim leading/trailing hyphens
}

function resolveCollision(dir, name, ext) {
  let candidate = name + ext;
  let counter = 2;
  while (existsSync(join(dir, candidate))) {
    candidate = `${name}-${counter}${ext}`;
    counter++;
  }
  return candidate;
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveSlugCollision(slug, existingIds) {
  if (!existingIds.includes(slug)) return slug;
  let counter = 2;
  while (existingIds.includes(`${slug}-${counter}`)) counter++;
  return `${slug}-${counter}`;
}

function nextPhotoId(photos) {
  const maxId = photos.reduce((max, p) => Math.max(max, parseInt(p.id, 10) || 0), 0);
  return String(maxId + 1);
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i] || '').length))
  );
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');

  console.log('');
  console.log(headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('│'));
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((c, i) => ` ${String(c || '').padEnd(widths[i])} `).join('│'));
  }
  console.log('');
}

// ─── Add Photo ──────────────────────────────────────────

async function addPhoto(rl) {
  const data = loadData();
  console.log('\n══ ADD PHOTO ══\n');

  // 1. Source file
  const sourcePath = (await rl.question('Source file path: ')).trim();
  if (!sourcePath || !existsSync(sourcePath)) {
    console.error('Error: File not found.');
    return;
  }
  const ext = extname(sourcePath).toLowerCase();
  if (!VALID_EXTENSIONS.includes(ext)) {
    console.error(`Error: Invalid file type "${ext}". Accepted: ${VALID_EXTENSIONS.join(', ')}`);
    return;
  }

  // 2. Title
  const title = (await rl.question('Title: ')).trim();
  if (!title) {
    console.error('Error: Title is required.');
    return;
  }

  // 3. Category
  console.log('\nCategories:');
  data.categories.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (${c.id})`));
  const catInput = (await rl.question('Category (number or ID): ')).trim();
  let category;
  const catIdx = parseInt(catInput, 10);
  if (catIdx >= 1 && catIdx <= data.categories.length) {
    category = data.categories[catIdx - 1].id;
  } else {
    category = catInput;
  }
  if (!data.categories.some(c => c.id === category)) {
    console.error(`Error: Category "${category}" not found.`);
    return;
  }

  // 4. Description
  const description = (await rl.question('Description (optional): ')).trim();

  // 5. Tags
  const tagsInput = (await rl.question('Tags (comma-separated, optional): ')).trim();
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

  // 6. Aspect ratio (auto-detect)
  let aspectRatio = 'landscape';
  try {
    const meta = await sharp(sourcePath).metadata();
    if (meta.width && meta.height) {
      aspectRatio = meta.height > meta.width ? 'portrait' : 'landscape';
      console.log(`  Auto-detected aspect ratio: ${aspectRatio} (${meta.width}×${meta.height})`);
    }
  } catch (_) {
    const arInput = (await rl.question('Aspect ratio (portrait/landscape, default landscape): ')).trim().toLowerCase();
    if (arInput === 'portrait') aspectRatio = 'portrait';
  }

  // 7. Featured
  const featuredInput = (await rl.question('Featured? (y/N): ')).trim().toLowerCase();
  const featured = featuredInput === 'y' || featuredInput === 'yes';

  // 8. Published
  const publishedInput = (await rl.question('Published? (Y/n): ')).trim().toLowerCase();
  const published = publishedInput !== 'n' && publishedInput !== 'no';

  // 9. Collection
  let selectedCollection = null;
  if (data.collections.length > 0) {
    console.log('\nCollections:');
    data.collections.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} (${c.id})`));
    console.log(`  0. Skip — don't add to a collection`);
    const colInput = (await rl.question('Add to collection (number or 0 to skip): ')).trim();
    const colIdx = parseInt(colInput, 10);
    if (colIdx >= 1 && colIdx <= data.collections.length) {
      selectedCollection = data.collections[colIdx - 1];
    }
  }

  // Generate ID
  const id = nextPhotoId(data.photos);

  // Sanitize and resolve filename (strip any lingering image extension to avoid .jpg.jpg)
  let rawName = sanitizeFilename(basename(sourcePath, ext));
  rawName = rawName.replace(/\.(jpg|jpeg|png)$/i, '');
  const finalFilename = resolveCollision(PHOTOS_DIR, rawName, '.jpg');
  const destPath = join(PHOTOS_DIR, finalFilename);

  // Confirmation
  console.log('\n── Summary ──');
  console.log(`  ID:         ${id}`);
  console.log(`  Title:      ${title}`);
  console.log(`  Category:   ${category}`);
  console.log(`  File:       ${finalFilename}`);
  console.log(`  Aspect:     ${aspectRatio}`);
  console.log(`  Featured:   ${featured}`);
  console.log(`  Published:  ${published}`);
  if (selectedCollection) console.log(`  Collection: ${selectedCollection.name}`);
  console.log('');

  const confirm = (await rl.question('Proceed? (Y/n): ')).trim().toLowerCase();
  if (confirm === 'n' || confirm === 'no') {
    console.log('Cancelled.');
    return;
  }

  // Execute: copy file
  try {
    copyFileSync(sourcePath, destPath);
  } catch (err) {
    console.error(`Error copying file: ${err.message}`);
    return;
  }

  // Execute: update JSON
  const photoEntry = {
    id,
    title,
    category,
    url: `/photos/${finalFilename}`,
    thumbnail: `/photos/${finalFilename}`,
    aspectRatio,
    featured,
    heroImage: false,
    date: new Date().toISOString().slice(0, 10),
    description: description || '',
    tags,
    order: data.photos.length + 1,
    published,
  };

  data.photos.push(photoEntry);

  if (selectedCollection) {
    const col = data.collections.find(c => c.id === selectedCollection.id);
    if (col) col.photoIds.push(id);
  }

  try {
    safeWriteData(data);
  } catch (err) {
    // Rollback: remove copied file
    try { unlinkSync(destPath); } catch (_) { /* ignore */ }
    console.error(`Error writing photos.json: ${err.message}`);
    return;
  }

  // Execute: run optimization
  console.log('\nRunning image optimization...');
  try {
    execSync('node scripts/optimize-images.js', { cwd: ROOT, stdio: 'inherit' });
  } catch (err) {
    console.error('\nOptimization failed. Rolling back...');
    // Rollback: remove copied file, revert JSON
    try { unlinkSync(destPath); } catch (_) { /* ignore */ }
    // Reload original and rewrite without the new entry
    data.photos = data.photos.filter(p => p.id !== id);
    if (selectedCollection) {
      const col = data.collections.find(c => c.id === selectedCollection.id);
      if (col) col.photoIds = col.photoIds.filter(pid => pid !== id);
    }
    try { safeWriteData(data); } catch (_) { /* ignore */ }
    console.error('Rollback complete. Photo was NOT added.');
    return;
  }

  console.log(`\n✓ Photo "${title}" added successfully (ID: ${id})`);
}

// ─── Add Collection ─────────────────────────────────────

async function addCollection(rl) {
  const data = loadData();
  console.log('\n══ ADD COLLECTION ══\n');

  // 1. Name
  const name = (await rl.question('Collection name: ')).trim();
  if (!name) {
    console.error('Error: Name is required.');
    return;
  }

  // 2. Description
  const description = (await rl.question('Description (optional): ')).trim();

  // 3. Date
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dateInput = (await rl.question(`Date (YYYY-MM, default ${defaultDate}): `)).trim();
  const date = dateInput || defaultDate;

  // 4. Tags
  const tagsInput = (await rl.question('Tags (comma-separated, optional): ')).trim();
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

  // 5. Select photos
  console.log('\nAvailable photos:');
  data.photos.forEach(p => console.log(`  ${p.id}. ${p.title} [${p.category}]`));
  const photoIdsInput = (await rl.question('Photo IDs (comma-separated): ')).trim();
  const photoIds = photoIdsInput.split(',').map(id => id.trim()).filter(Boolean);

  const validPhotoIds = photoIds.filter(id => data.photos.some(p => p.id === id));
  if (validPhotoIds.length === 0) {
    console.error('Error: No valid photo IDs provided.');
    return;
  }

  const invalidIds = photoIds.filter(id => !data.photos.some(p => p.id === id));
  if (invalidIds.length > 0) {
    console.log(`  Warning: Skipping invalid IDs: ${invalidIds.join(', ')}`);
  }

  // 6. Cover photo
  console.log('\nSelected photos:');
  validPhotoIds.forEach(id => {
    const p = data.photos.find(ph => ph.id === id);
    console.log(`  ${id}. ${p.title}`);
  });
  const coverInput = (await rl.question(`Cover photo ID (default ${validPhotoIds[0]}): `)).trim();
  const coverPhotoId = coverInput && validPhotoIds.includes(coverInput) ? coverInput : validPhotoIds[0];

  // Generate slug
  const existingIds = data.collections.map(c => c.id);
  const slug = resolveSlugCollision(generateSlug(name), existingIds);

  // Confirmation
  console.log('\n── Summary ──');
  console.log(`  ID:         ${slug}`);
  console.log(`  Name:       ${name}`);
  console.log(`  Photos:     ${validPhotoIds.length}`);
  console.log(`  Cover:      ${coverPhotoId}`);
  console.log(`  Date:       ${date}`);
  console.log('');

  const confirm = (await rl.question('Proceed? (Y/n): ')).trim().toLowerCase();
  if (confirm === 'n' || confirm === 'no') {
    console.log('Cancelled.');
    return;
  }

  const collection = {
    id: slug,
    name,
    description: description || '',
    coverPhotoId,
    photoIds: validPhotoIds,
    date,
    tags,
  };

  data.collections.push(collection);

  try {
    safeWriteData(data);
  } catch (err) {
    console.error(`Error writing photos.json: ${err.message}`);
    return;
  }

  console.log(`\n✓ Collection "${name}" created (ID: ${slug})`);
}

// ─── Manage ─────────────────────────────────────────────

async function manage(rl) {
  const menuLoop = true;
  while (menuLoop) {
    const data = loadData();
    console.log('\n══ CONTENT MANAGEMENT ══\n');
    console.log('  1. List photos');
    console.log('  2. List collections');
    console.log('  3. Toggle publish state');
    console.log('  4. Exit');

    const choice = (await rl.question('\nChoice: ')).trim();

    if (choice === '1') {
      const rows = data.photos.map(p => {
        const cols = data.collections
          .filter(c => c.photoIds.includes(p.id))
          .map(c => c.name);
        return [
          p.id,
          p.title,
          p.category,
          p.published !== false ? 'published' : 'draft',
          cols.join(', ') || '—',
        ];
      });
      printTable(['ID', 'Title', 'Category', 'Status', 'Collections'], rows);
    } else if (choice === '2') {
      const rows = data.collections.map(c => [
        c.id,
        c.name,
        String(c.photoIds.length),
        c.date || '—',
      ]);
      printTable(['ID', 'Name', 'Photos', 'Date'], rows);
    } else if (choice === '3') {
      const rows = data.photos.map(p => [
        p.id,
        p.title,
        p.published !== false ? 'published' : 'draft',
      ]);
      printTable(['ID', 'Title', 'Status'], rows);

      const toggleId = (await rl.question('Photo ID to toggle: ')).trim();
      const photo = data.photos.find(p => p.id === toggleId);
      if (!photo) {
        console.error(`Error: Photo "${toggleId}" not found.`);
        continue;
      }
      const currentState = photo.published !== false;
      photo.published = !currentState;
      try {
        safeWriteData(data);
        console.log(`\n✓ "${photo.title}" is now ${photo.published ? 'published' : 'draft'}`);
      } catch (err) {
        console.error(`Error writing photos.json: ${err.message}`);
      }
    } else if (choice === '4') {
      console.log('Bye.');
      break;
    } else {
      console.log('Invalid choice.');
    }
  }
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  const command = process.argv[2];

  if (!command || !['add-photo', 'add-collection', 'manage'].includes(command)) {
    console.log('Usage:');
    console.log('  node scripts/manage-content.js add-photo');
    console.log('  node scripts/manage-content.js add-collection');
    console.log('  node scripts/manage-content.js manage');
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    if (command === 'add-photo') await addPhoto(rl);
    else if (command === 'add-collection') await addCollection(rl);
    else if (command === 'manage') await manage(rl);
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
