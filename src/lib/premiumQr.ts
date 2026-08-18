import QRCode from "qrcode";

export interface PremiumQrOptions {
  showLabel?: boolean;
  label?: string;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Builds a luxury SVG QR code matching the MyLuxCards premium aesthetic:
 * - Deep black background (#050505)
 * - Gold circular dot modules (#D4AF37)
 * - Rounded-square finder eyes with black separation ring & rounded inner eye
 * - Thin rounded gold outer frame
 * - Centered gold "SCAN ME" header
 * - High Error Correction (Level 'H')
 */
export function buildPremiumQrSvg(text: string, options: PremiumQrOptions = {}): string {
  const {
    showLabel = true,
    label = "SCAN ME",
    darkColor = "#D4AF37",
    lightColor = "#050505",
  } = options;

  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size; // number of modules per side (e.g. 29, 33)
  const moduleSize = 10;
  const quietZoneModules = 4;
  const quietZone = quietZoneModules * moduleSize; // 40px

  const matrixSize = size * moduleSize;
  const frameInnerWidth = matrixSize + quietZone * 2;
  const frameInnerHeight = frameInnerWidth;

  const framePadding = 16;
  const labelHeight = showLabel ? 44 : 0;
  const topOffset = framePadding + labelHeight;

  const totalWidth = frameInnerWidth + framePadding * 2;
  const totalHeight = topOffset + frameInnerHeight + framePadding;

  const frameX = framePadding;
  const frameY = topOffset;
  const qrOriginX = frameX + quietZone;
  const qrOriginY = frameY + quietZone;

  // Finder pattern coordinates (Top-Left, Top-Right, Bottom-Left 7x7 areas)
  const isFinder = (x: number, y: number) => {
    if (x < 7 && y < 7) return true;
    if (x >= size - 7 && y < 7) return true;
    if (x < 7 && y >= size - 7) return true;
    return false;
  };

  const dots: string[] = [];
  const dotRadius = moduleSize * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isFinder(x, y)) continue;
      if (qr.modules.data[y * size + x]) {
        const cx = (qrOriginX + x * moduleSize + moduleSize / 2).toFixed(2);
        const cy = (qrOriginY + y * moduleSize + moduleSize / 2).toFixed(2);
        dots.push(`<circle cx="${cx}" cy="${cy}" r="${dotRadius.toFixed(2)}" fill="${darkColor}" />`);
      }
    }
  }

  const renderFinderEye = (fx: number, fy: number) => {
    const x = qrOriginX + fx * moduleSize;
    const y = qrOriginY + fy * moduleSize;
    const outerSize = 7 * moduleSize;
    const gapSize = 5 * moduleSize;
    const gapOffset = 1 * moduleSize;
    const innerSize = 3 * moduleSize;
    const innerOffset = 2 * moduleSize;

    return [
      `<rect x="${x}" y="${y}" width="${outerSize}" height="${outerSize}" rx="16" fill="${darkColor}" />`,
      `<rect x="${x + gapOffset}" y="${y + gapOffset}" width="${gapSize}" height="${gapSize}" rx="10" fill="${lightColor}" />`,
      `<rect x="${x + innerOffset}" y="${y + innerOffset}" width="${innerSize}" height="${innerSize}" rx="7" fill="${darkColor}" />`,
    ].join("");
  };

  const finders = [
    renderFinderEye(0, 0),
    renderFinderEye(size - 7, 0),
    renderFinderEye(0, size - 7),
  ].join("");

  let labelSvg = "";
  if (showLabel && label) {
    const labelX = (totalWidth / 2).toFixed(2);
    const labelY = (framePadding + 26).toFixed(2);
    labelSvg = `<text x="${labelX}" y="${labelY}" fill="${darkColor}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-size="14" font-weight="700" letter-spacing="3" text-anchor="middle">${label.toUpperCase()}</text>`;
  }

  const frameSvg = `<rect x="${frameX.toFixed(2)}" y="${frameY.toFixed(2)}" width="${frameInnerWidth.toFixed(2)}" height="${frameInnerHeight.toFixed(2)}" rx="18" fill="none" stroke="${darkColor}" stroke-width="1.5" />`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">\n` +
    `  <rect width="100%" height="100%" fill="${lightColor}" />\n` +
    `  ${labelSvg}\n` +
    `  ${frameSvg}\n` +
    `  ${finders}\n` +
    `  <g>\n` +
    `    ${dots.join("\n    ")}\n` +
    `  </g>\n` +
    `</svg>`
  );
}

/**
 * Converts an SVG string into a high-resolution PNG blob (default 1500px).
 */
export async function svgToHighResPngBlob(svg: string, targetDimension = 1500): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to render QR SVG image"));
    });
    image.src = svgUrl;
    await loaded;

    const viewBoxMatch = svg.match(/viewBox=["']\d+\s+\d+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/);
    let naturalWidth = image.naturalWidth || 400;
    let naturalHeight = image.naturalHeight || 460;
    if (viewBoxMatch && viewBoxMatch[1] && viewBoxMatch[2]) {
      naturalWidth = parseFloat(viewBoxMatch[1]);
      naturalHeight = parseFloat(viewBoxMatch[2]);
    }

    const scale = targetDimension / Math.max(naturalWidth, naturalHeight);
    const canvasWidth = Math.round(naturalWidth * scale);
    const canvasHeight = Math.round(naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create canvas context");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to convert canvas to PNG"))), "image/png");
    });
    return pngBlob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
