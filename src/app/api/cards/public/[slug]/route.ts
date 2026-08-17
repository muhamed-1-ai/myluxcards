import { createHash } from "node:crypto";
import { cleanSlug, safePublicCard } from "@/lib/cards";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!process.env.DATABASE_URL) return Response.json({ message: "Cards are not configured." }, { status: 503 });
  const { slug } = await params;
  try {
    const card = await prisma.digitalCard.findUnique({
      where: { slug: cleanSlug(slug) },
      select: {
        id: true,
        ownerId: true,
        slug: true,
        profile: true,
        active: true,
        activatedAt: true,
        expiresAt: true,
      },
    });
    if (!card) return Response.json({ message: "Card not found." }, { status: 404 });
    const row = {
      id: card.id,
      owner_id: card.ownerId,
      slug: card.slug,
      profile: card.profile,
      active: card.active,
      activated_at: card.activatedAt,
      expires_at: card.expiresAt,
    };
    // Activated cards remain public until their owner explicitly switches them
    // off. Legacy expiry values must not silently override the owner's status.
    const publiclyActive = Boolean(row.active && row.activated_at);
    let previewAuthorized = false;
    if (!publiclyActive) {
      const identity = await currentIdentity();
      previewAuthorized = identity?.id === row.owner_id;
      if (!previewAuthorized) return Response.json({
        message: "Card unavailable.",
        reason: !row.activated_at ? "NOT_ACTIVATED" : !row.active ? "SWITCHED_OFF" : "UNAVAILABLE",
      }, { status: 404 });
    }
    return Response.json({ card: { ...safePublicCard(row), previewAuthorized } });
  } catch { return Response.json({ message: "Card unavailable." }, { status: 503 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { slug } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const card = await prisma.digitalCard.findUnique({
      where: { slug: cleanSlug(slug) },
      select: { id: true, active: true, activatedAt: true },
    });
    if (!card?.active || !card.activatedAt) return Response.json({ message: "Card unavailable." }, { status: 404 });
    const type = String(body.type || "");
    if (!["VIEW","CONTACT_SAVE","LINK_CLICK","SHARE"].includes(type)) return Response.json({ message: "Invalid event." }, { status: 400 });
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] || "";
    const day = new Date().toISOString().slice(0,10);
    const visitorHash = createHash("sha256").update(`${process.env.ANALYTICS_SALT || process.env.NEXTAUTH_SECRET || "salt"}:${day}:${forwarded}:${request.headers.get("user-agent") || ""}`).digest("hex");
    
    await prisma.cardEvent.create({
      data: {
        cardId: card.id,
        eventType: type,
        channel: ["NFC","QR","LINK","PREVIEW"].includes(body.channel) ? body.channel : "LINK",
        linkType: String(body.linkType || "").slice(0,40) || null,
        visitorHash,
      },
    });
    return Response.json({ ok: true });
  } catch { return Response.json({ ok: false }, { status: 202 }); }
}
