import { buildPremiumQrSvg } from "@/lib/premiumQr";
import { safeError } from "@/lib/adminAuth";
import { getPublicCardUrl } from "@/lib/url";

export const runtime = "nodejs";

/** GET /api/cards/qr?slug=... – returns a luxury SVG QR code for the card URL. Public route. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug")?.trim();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return Response.json({ message: "Invalid slug." }, { status: 400 });
    }

    const cardUrl = getPublicCardUrl(slug, request);

    const svg = buildPremiumQrSvg(cardUrl, { showLabel: true, label: "SCAN ME" });

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
