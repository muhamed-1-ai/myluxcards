import { cleanSlug } from "@/lib/cards";
import { validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0,120);
    const email = String(body.email || "").trim().toLowerCase().slice(0,320);
    const phone = String(body.phone || "").trim().slice(0,30);
    if (name.length < 2 || (!email && !phone) || body.consent !== true) return Response.json({ message: "Enter your name, email or phone, and confirm consent." }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Enter a valid email." }, { status: 400 });
    
    const card = await prisma.digitalCard.findFirst({
      where: { slug: cleanSlug(slug), active: true },
      select: { id: true, activatedAt: true },
    });
    if (!card?.activatedAt) return Response.json({ message: "Card unavailable." }, { status: 404 });
    
    await prisma.$transaction([
      prisma.cardLead.create({
        data: {
          cardId: card.id,
          name,
          email: email || null,
          phone: phone || null,
          company: String(body.company || "").trim().slice(0,160) || null,
          message: String(body.message || "").trim().slice(0,1000) || null,
          consentAt: new Date(),
        },
      }),
      prisma.cardEvent.create({
        data: {
          cardId: card.id,
          eventType: "LEAD",
          channel: "LINK",
        },
      }),
    ]);
    return Response.json({ ok: true }, { status: 201 });
  } catch { return Response.json({ message: "Your details could not be sent." }, { status: 500 }); }
}
