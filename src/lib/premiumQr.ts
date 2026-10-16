import QRCode from "qrcode";

export interface PremiumQrOptions {
  showLabel?: boolean;
  label?: string;
  darkColor?: string;
  lightColor?: string;
  showFrame?: boolean;
  variant?: "default" | "admin_framed";
}

/**
 * Builds the Admin User QR code matching the reference design:
 * - Solid white background (#FFFFFF)
 * - Bold black heading "3G ZAPPIT" centered above the frame
 * - Bold black outer frame with smoothly rounded corners
 * - Centered square QR code with circular black dots
 * - Three rounded-square black corner markers with white insets and black rounded-square centers
 * - Unobstructed white quiet zone of at least four QR modules on every side
 */
export function buildAdminUserQrSvg(text: string): string {
  const qr = QRCode.create(text || "https://3gzappit.com", { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const moduleSize = 10;

  // Matrix dimensions
  const matrixSize = size * moduleSize;

  // Frame padding around QR (54px = 5.4 modules, strictly > 4 modules quiet zone)
  const framePadding = 54;
  const frameWidth = matrixSize + framePadding * 2;
  const frameHeight = frameWidth;

  // Outer canvas margins and top heading space
  const outerMargin = 20;
  const topPadding = 24;
  const headingHeight = 28;
  const headingGap = 16;
  const frameTop = topPadding + headingHeight + headingGap;

  const totalWidth = frameWidth + outerMargin * 2;
  const totalHeight = frameTop + frameHeight + outerMargin;

  const frameX = outerMargin;
  const frameY = frameTop;

  const qrOriginX = frameX + framePadding;
  const qrOriginY = frameY + framePadding;

  const headingX = (totalWidth / 2).toFixed(2);
  const headingY = (topPadding + 22).toFixed(2);

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
        dots.push(`<circle cx="${cx}" cy="${cy}" r="${dotRadius.toFixed(2)}" fill="#000000" />`);
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
      `<rect x="${x}" y="${y}" width="${outerSize}" height="${outerSize}" rx="16" fill="#000000" />`,
      `<rect x="${x + gapOffset}" y="${y + gapOffset}" width="${gapSize}" height="${gapSize}" rx="10" fill="#FFFFFF" />`,
      `<rect x="${x + innerOffset}" y="${y + innerOffset}" width="${innerSize}" height="${innerSize}" rx="6" fill="#000000" />`,
    ].join("");
  };

  const finders = [
    renderFinderEye(0, 0),
    renderFinderEye(size - 7, 0),
    renderFinderEye(0, size - 7),
  ].join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">\n` +
    `  <rect width="100%" height="100%" fill="#FFFFFF" />\n` +
    `  <text x="${headingX}" y="${headingY}" fill="#000000" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="24" font-weight="900" letter-spacing="2.5" text-anchor="middle">3G ZAPPIT</text>\n` +
    `  <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="36" fill="none" stroke="#000000" stroke-width="8" />\n` +
    `  ${finders}\n` +
    `  <g>\n` +
    `    ${dots.join("\n    ")}\n` +
    `  </g>\n` +
    `</svg>`
  );
}

/**
 * Builds a high-tech SVG QR code matching the Zappit tech ecosystem aesthetic:
 * - Deep black background (#050505)
 * - Electric Blue circular dot modules (#0066FF)
 * - Rounded-square finder eyes with black separation ring & rounded inner eye
 * - Thin rounded blue outer frame
 * - Centered "SCAN ME" header
 * - High Error Correction (Level 'H')
 */
export function buildPremiumQrSvg(text: string, options: PremiumQrOptions = {}): string {
  if (options.variant === "admin_framed") {
    return buildAdminUserQrSvg(text);
  }
  const {
    showLabel = true,
    label = "SCAN ME",
    darkColor = "#0066FF",
    lightColor = "#050505",
    showFrame = true,
  } = options;

  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size; // number of modules per side (e.g. 29, 33)
  const moduleSize = 10;
  const quietZoneModules = 4;
  const quietZone = quietZoneModules * moduleSize; // 40px

  const matrixSize = size * moduleSize;
  const frameInnerWidth = matrixSize + quietZone * 2;
  const frameInnerHeight = frameInnerWidth;

  const framePadding = showFrame ? 16 : 0;
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

  const frameSvg = showFrame
    ? `<rect x="${frameX.toFixed(2)}" y="${frameY.toFixed(2)}" width="${frameInnerWidth.toFixed(2)}" height="${frameInnerHeight.toFixed(2)}" rx="18" fill="none" stroke="${darkColor}" stroke-width="1.5" />`
    : "";

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
export async function svgToHighResPngBlob(svg: string, targetDimension = 1500, backgroundColor?: string): Promise<Blob> {
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
    const rectFillMatch = svg.match(/<rect[^>]+width=["']100%["'][^>]+fill=["']([^"']+)["']/i);
    const bgFill = backgroundColor || (rectFillMatch ? rectFillMatch[1] : "#050505");
    ctx.fillStyle = bgFill;
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
