const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateAssets() {
  const svgPath = path.join(__dirname, '..', 'public', 'assets', 'logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  // 1. logo-navbar.png (high DPI navbar image, e.g., 440x100)
  await sharp(svgBuffer)
    .resize(440, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(__dirname, '..', 'public', 'assets', 'logo-navbar.png'));

  // 2. logo-navbar-keyed.png
  await sharp(svgBuffer)
    .resize(440, 100, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(__dirname, '..', 'public', 'assets', 'logo-navbar-keyed.png'));

  // 3. logo-premium.png (loading screen & footer logo)
  await sharp(svgBuffer)
    .resize(500, 114, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(__dirname, '..', 'public', 'assets', 'logo-premium.png'));

  // 4. favicon.ico (icon mark only)
  const iconMarkSvg = `
  <svg width="64" height="64" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="36" height="36" rx="10" fill="#080B12" stroke="#00D9FF" stroke-width="2"/>
    <path d="M12 14C16.4 9.6 23.6 9.6 28 14" stroke="#00D9FF" stroke-width="2" stroke-linecap="round"/>
    <path d="M15 18C17.8 15.2 22.2 15.2 25 18" stroke="#0066FF" stroke-width="2" stroke-linecap="round"/>
    <path d="M22 17L14 26H20L18 31L26 22H20L22 17Z" fill="#00D9FF"/>
    <circle cx="28" cy="11" r="2.5" fill="#B026FF"/>
  </svg>`;
  
  await sharp(Buffer.from(iconMarkSvg))
    .resize(64, 64)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'favicon.ico'));

  console.log('Successfully generated crisp Zappit logo assets & favicon!');
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
