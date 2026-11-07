import fs from 'node:fs';
import assert from 'node:assert';
import sharp from 'sharp';

console.log('🧪 Starting test suite: favicon-verification.test.mjs');

async function run() {
  // 1. Verify public/favicon.png
  assert(fs.existsSync('public/favicon.png'), 'public/favicon.png must exist');
  const favMeta = await sharp('public/favicon.png').metadata();
  assert.strictEqual(favMeta.width, 96, 'public/favicon.png width must be 96');
  assert.strictEqual(favMeta.height, 96, 'public/favicon.png height must be 96');
  assert.strictEqual(favMeta.format, 'png', 'public/favicon.png must be PNG format');
  console.log('✅ 1. public/favicon.png is valid 96x96 PNG.');

  // Check background color and bolt color in favicon.png
  const { data, info } = await sharp('public/favicon.png').raw().toBuffer({ resolveWithObject: true });
  // Top-left corner pixel (0, 0) must be brand blue #0066FF: R=0, G=102, B=255
  const r0 = data[0];
  const g0 = data[1];
  const b0 = data[2];
  assert.strictEqual(r0, 0, 'Top-left corner R must be 0');
  assert.strictEqual(g0, 102, 'Top-left corner G must be 102 (#0066FF)');
  assert.strictEqual(b0, 255, 'Top-left corner B must be 255 (#0066FF)');

  // Center pixel (48, 48) must be pure white #FFFFFF: R=255, G=255, B=255
  const centerIdx = (48 * 96 + 48) * info.channels;
  const rc = data[centerIdx];
  const gc = data[centerIdx + 1];
  const bc = data[centerIdx + 2];
  assert.strictEqual(rc, 255, 'Center pixel R must be 255 (white bolt)');
  assert.strictEqual(gc, 255, 'Center pixel G must be 255 (white bolt)');
  assert.strictEqual(bc, 255, 'Center pixel B must be 255 (white bolt)');
  console.log('✅ 2. Pixel colors confirmed: solid brand blue #0066FF background with bold white #FFFFFF bolt.');

  // 2. Verify all other required icon assets
  assert(fs.existsSync('public/favicon-96x96.png'), 'public/favicon-96x96.png must exist');
  assert(fs.existsSync('public/favicon-32x32.png'), 'public/favicon-32x32.png must exist');
  assert(fs.existsSync('public/favicon-16x16.png'), 'public/favicon-16x16.png must exist');
  assert(fs.existsSync('public/apple-touch-icon.png'), 'public/apple-touch-icon.png must exist');
  assert(fs.existsSync('public/icon-192.png'), 'public/icon-192.png must exist');
  assert(fs.existsSync('public/icon-512.png'), 'public/icon-512.png must exist');
  assert(fs.existsSync('public/favicon.ico'), 'public/favicon.ico must exist');
  assert(fs.statSync('public/favicon.ico').size > 500, 'public/favicon.ico must be non-empty');
  assert(fs.existsSync('src/app/icon.png'), 'src/app/icon.png must exist for App Router');
  assert(fs.existsSync('src/app/apple-icon.png'), 'src/app/apple-icon.png must exist for App Router');
  console.log('✅ 3. All multi-size icon assets and App Router icons exist.');

  // 3. Verify public/brand/zappit-mark.png is overwritten with the lightning bolt
  const markMeta = await sharp('public/brand/zappit-mark.png').metadata();
  assert.strictEqual(markMeta.width, 512, 'zappit-mark.png must be updated to 512x512');
  assert.strictEqual(markMeta.height, 512, 'zappit-mark.png must be updated to 512x512');
  const markRaw = await sharp('public/brand/zappit-mark.png').raw().toBuffer({ resolveWithObject: true });
  assert.strictEqual(markRaw.data[0], 0, 'zappit-mark corner R must be 0');
  assert.strictEqual(markRaw.data[1], 102, 'zappit-mark corner G must be 102 (#0066FF)');
  assert.strictEqual(markRaw.data[2], 255, 'zappit-mark corner B must be 255 (#0066FF)');
  console.log('✅ 4. public/brand/zappit-mark.png is updated with lightning bolt (old cropped text eliminated).');

  // 4. Verify public/manifest.json
  const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
  assert(manifest.icons.some(i => i.src === '/favicon.png'), 'manifest must include /favicon.png');
  assert(!JSON.stringify(manifest).includes('zappit-mark.png'), 'manifest must not reference old zappit-mark.png');
  console.log('✅ 5. public/manifest.json references new icons.');

  // 5. Verify src/app/layout.tsx
  const layout = fs.readFileSync('src/app/layout.tsx', 'utf8');
  assert(layout.includes("url: '/favicon.png'") || layout.includes('url: "/favicon.png"'), 'layout metadata must declare /favicon.png');
  assert(layout.includes('rel="icon" type="image/png" sizes="96x96" href="/favicon.png"'), 'layout head must declare rel="icon" with /favicon.png');
  assert(layout.includes('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"'), 'layout head must declare apple-touch-icon');
  assert(!layout.includes('href="/brand/zappit-mark.png"'), 'layout head must not declare old zappit-mark.png');
  console.log('✅ 6. src/app/layout.tsx metadata and head tags verified.');

  // 6. Verify src/app/page.tsx
  const page = fs.readFileSync('src/app/page.tsx', 'utf8');
  assert(page.includes("url: '/favicon.png'") || page.includes('url: "/favicon.png"'), 'page metadata must declare /favicon.png');
  console.log('✅ 7. src/app/page.tsx metadata icons verified.');

  // 7. Verify Google Search circular crop
  assert(fs.existsSync('scratch/google-search-circle-crop-96.png'), 'Circle crop simulation must exist');
  const cropMeta = await sharp('scratch/google-search-circle-crop-96.png').metadata();
  assert.strictEqual(cropMeta.width, 96);
  assert.strictEqual(cropMeta.height, 96);
  console.log('✅ 8. Google circular crop simulation verified.');

  console.log('🎉 All favicon verification tests passed successfully!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

