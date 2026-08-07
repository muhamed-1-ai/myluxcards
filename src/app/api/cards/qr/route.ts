import QRCode from "qrcode";
import { safeError } from "@/lib/adminAuth";

export const runtime = "nodejs";

const buildGoldQrSvg = (text: string, colors: { dark: string; light: string }) => {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const moduleSize = 8;
  const margin = 16;
  const totalSize = size * moduleSize + margin * 2;
  const rects: string[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.data[y * size + x]) {
        const px = margin + x * moduleSize;
        const py = margin + y * moduleSize;
        rects.push(
          `<rect x="${px}" y="${py}" width="${moduleSize}" height="${moduleSize}" rx="${moduleSize / 2}" ry="${moduleSize / 2}" />`
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">` +
    `<rect width="100%" height="100%" fill="${colors.light}"/>` +
    `<rect x="${margin - 1}" y="${margin - 1}" width="${size * moduleSize + 2}" height="${size * moduleSize + 2}" rx="16" fill="none" stroke="${colors.dark}" stroke-width="2"/>` +
    `<g fill="${colors.dark}">` +
    rects.join("") +
    `</g>` +
    `</svg>`;
};

/** GET /api/cards/qr?slug=... – returns an SVG QR code for the card URL. Public route. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ message: "Invalid slug." }, { status: 400 });
    }

    const appUrl = (process.env.APP_URL || "https://myluxcards.vercel.app").replace(/\/$/, "");
    const cardUrl = `${appUrl}/card/${slug}`;

    const svg = buildGoldQrSvg(cardUrl, { dark: "#d4af37", light: "#000000" });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return safeError(error);
  }
}
