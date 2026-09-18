const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateAssets() {
  const brandSourcePath = path.join(__dirname, '..', 'public', 'branding', 'zappit-logo.png');
  if (!fs.existsSync(brandSourcePath)) {
    throw new Error(`Canonical logo not found at: ${brandSourcePath}`);
  }

  const rawBuffer = fs.readFileSync(brandSourcePath);
  const metadata = await sharp(rawBuffer).metadata();

  // Create transparent buffer by keying out white background pixels
  const { data, info } = await sharp(rawBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // set alpha to 0
    }
  }

  const transparentBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  const publicAssetsDir = path.join(__dirname, '..', 'public', 'assets');
  const rootAssetsDir = path.join(__dirname, '..', 'assets');
  const nestedAssetsDir = path.join(__dirname, '..', 'public', 'assets', 'assets');

  [publicAssetsDir, rootAssetsDir, nestedAssetsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 1. logo-transparent.png
  fs.writeFileSync(path.join(publicAssetsDir, 'logo-transparent.png'), transparentBuffer);
  fs.writeFileSync(path.join(rootAssetsDir, 'logo-transparent.png'), transparentBuffer);

  // 2. logo.png and logo-3d.png
  fs.writeFileSync(path.join(publicAssetsDir, 'logo.png'), transparentBuffer);
  fs.writeFileSync(path.join(publicAssetsDir, 'logo-3d.png'), transparentBuffer);
  fs.writeFileSync(path.join(rootAssetsDir, 'logo.png'), transparentBuffer);
  fs.writeFileSync(path.join(rootAssetsDir, 'logo-3d.png'), transparentBuffer);
  fs.writeFileSync(path.join(publicAssetsDir, 'zappit-logo.png'), rawBuffer);

  // 3. logo-navbar.png (high DPI navbar image, e.g., 440x220)
  await sharp(transparentBuffer)
    .resize(440, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(publicAssetsDir, 'logo-navbar.png'));

  // 4. logo-navbar-keyed.png
  await sharp(transparentBuffer)
    .resize(440, 220, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(publicAssetsDir, 'logo-navbar-keyed.png'));

  // 5. logo-premium.png (loading screen & footer logo)
  await sharp(transparentBuffer)
    .resize(500, 250, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(publicAssetsDir, 'logo-premium.png'));

  // 6. SVG Wrappers so any image tag loading logo.svg gets the exact high-res image
  const base64Transparent = transparentBuffer.toString('base64');
  const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${info.width} ${info.height}" width="100%" height="100%">
  <image href="data:image/png;base64,${base64Transparent}" width="${info.width}" height="${info.height}" />
</svg>`;

  fs.writeFileSync(path.join(publicAssetsDir, 'logo.svg'), svgWrapper);
  fs.writeFileSync(path.join(publicAssetsDir, 'logo-transparent.svg'), svgWrapper);
  fs.writeFileSync(path.join(rootAssetsDir, 'logo.svg'), svgWrapper);
  fs.writeFileSync(path.join(nestedAssetsDir, 'logo.svg'), svgWrapper);

  // 7. favicon.ico and icon-mark.png (cropped signal icon mark)
  const iconCrop = await sharp(transparentBuffer)
    .extract({
      left: Math.floor(info.width * 0.65),
      top: 10,
      width: Math.floor(info.width * 0.32),
      height: Math.floor(info.height * 0.65),
    })
    .trim()
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.ico'), iconCrop);
  fs.writeFileSync(path.join(publicAssetsDir, 'icon-mark.png'), iconCrop);

  console.log('Successfully built crisp 3G Zappit official logo assets & favicon!');
}

generateAssets().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
