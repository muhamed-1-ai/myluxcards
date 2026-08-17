import { timingSafeEqual } from "node:crypto";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { hashActivationCode } from "@/lib/cards";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const raw = String(body.code || "").toUpperCase().replace(/^\s*MLC/i, "").replace(/[^0-9A-F]/g, "").slice(0, 16);
    const code = raw ? `MLC-${raw.match(/.{1,4}/g)?.join("-") || raw}` : "";
    if (!/^MLC-(?:[0-9A-F]{4}-){3}[0-9A-F]{4}$/i.test(code)) return Response.json({ message: "Enter the complete new activation code, for example MLC-12AB-34CD-56EF-7890." }, { status: 400 });
    // An unused activation code is a bearer credential supplied with a physical
    // card. The signed-in customer who possesses it claims that exact card.
    const submittedHash = hashActivationCode(code);
    const candidateCards = await prisma.digitalCard.findMany({
      where: { activationCodeHash: submittedHash },
      select: { id: true, ownerId: true, slug: true, activationCodeHash: true },
      take: 5,
    });
    
    const card = candidateCards.find((candidate) => {
      const storedHash = String(candidate.activationCodeHash || "");
      if (storedHash.length !== submittedHash.length) return false;
      return timingSafeEqual(Buffer.from(storedHash, "utf8"), Buffer.from(submittedHash, "utf8"));
    });
    if (!card) return Response.json({ message: "This activation code is invalid, expired, or has already been used." }, { status: 400 });
    
    if (card.ownerId !== identity.id) {
      const [eventCount, leadCount] = await Promise.all([
        prisma.cardEvent.count({ where: { cardId: card.id } }),
        prisma.cardLead.count({ where: { cardId: card.id } }),
      ]);
      if (eventCount > 0 || leadCount > 0) return Response.json({ message: "This used card has private history and cannot be transferred. Ask MyLuxCards to issue a new card." }, { status: 409 });
    }

    const claimed = await prisma.digitalCard.updateMany({
      where: { id: card.id, activationCodeHash: submittedHash },
      data: {
        ownerId: identity.id,
        activatedAt: new Date(),
        // expires_at: null
        expiresAt: null,
        active: true,
        activationCodeHash: null,
      },
    });
    if (!claimed.count) return Response.json({ message: "This activation code has already been used. Ask MyLuxCards for a new code." }, { status: 409 });
    return Response.json({ ok: true, cardId: card.id, slug: card.slug });
  } catch (error) { return safeError(error); }
}
