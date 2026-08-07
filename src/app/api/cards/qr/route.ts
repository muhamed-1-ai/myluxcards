import QRCode from "qrcode";
import { safeError } from "@/lib/adminAuth";

export const runtime = "nodejs";

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

    const svg = await QRCode.toString(cardUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      color: { dark: "#d4af37", light: "#000000" },
      margin: 1,
    });

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
