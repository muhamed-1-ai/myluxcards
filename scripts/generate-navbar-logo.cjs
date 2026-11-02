const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createTightLogo() {
  const src = path.join(__dirname, '..', 'public', 'brand', 'zappit-logo-transparent.png');
  const outPng = path.join(__dirname, '..', 'public', 'brand', 'zappit-logo-navbar.png');
  const outSvg = path.join(__dirname, '..', 'public', 'brand', 'zappit-logo-navbar.svg');

  // Extract exact bounding box: left 24, top 20, width 850, height 396
  const trimmed = sharp(src).extract({ left: 24, top: 20, width: 850, height: 396 });
  await trimmed.png({ compressionLevel: 9 }).toFile(outPng);

  const meta = await sharp(outPng).metadata();
  console.log('Created tight navbar logo:', meta.width, 'x', meta.height, 'channels:', meta.channels, 'hasAlpha:', meta.hasAlpha);

  // Clean SVG wrapper with precise viewBox
  const pngBuffer = await sharp(outPng).toBuffer();
  const b64 = pngBuffer.toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 396" width="100%" height="100%" role="img" aria-label="Zappit">
  <image href="data:image/png;base64,${b64}" width="850" height="396" preserveAspectRatio="xMidYMid meet" />
</svg>
`;
  fs.writeFileSync(outSvg, svgContent, 'utf8');
  console.log('Created tight navbar SVG:', outSvg);
}

createTightLogo().catch(console.error);

