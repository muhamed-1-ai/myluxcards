import { randomBytes } from "node:crypto";
import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanSlug, hashActivationCode } from "@/lib/cards";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const [cards, customers] = await Promise.all([
      prisma.digitalCard.findMany({
        select: {
          id: true,
          ownerId: true,
          slug: true,
          active: true,
          activatedAt: true,
          expiresAt: true,
          activationCodeHash: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.user.findMany({
        // role=eq.CUSTOMER
        // owner_id: ownerId
        where: { role: "CUSTOMER" },
        select: {
          id: true,
          name: true,
          email: true,
          disabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    const owners = customers.map(c => ({
      id: c.id,
      name: c.name || null,
      email: c.email,
      disabled: c.disabled,
      created_at: c.createdAt,
    }));

    const ownerById = new Map(owners.map(owner => [owner.id, owner]));

    const cardRows = cards.map(card => ({
      id: card.id,
      owner_id: card.ownerId,
      slug: card.slug,
      active: card.active,
      activated_at: card.activatedAt,
      expires_at: card.expiresAt,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      hasActivationCode: Boolean(card.activationCodeHash),
      owner: card.ownerId ? ownerById.get(card.ownerId) || null : null,
    }));

    const customersWithCards = new Set(cards.map(c => c.ownerId).filter(Boolean));
    const customersWithoutCards = owners.filter(owner => !customersWithCards.has(owner.id)).map(owner => ({
      id: `customer-${owner.id}`,
      owner_id: owner.id,
      owner,
      cardMissing: true,
      active: false,
      activated_at: null,
      hasActivationCode: false,
      created_at: owner.created_at,
      updated_at: owner.created_at,
    }));

    return Response.json({ data: [...cardRows, ...customersWithoutCards] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) { return safeError(error); }
}

// The plaintext code is returned once to an authenticated administrator.
// Only a salted hash is stored.
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const cardId = typeof body.cardId === "string" && /^[0-9a-f-]{36}$/i.test(body.cardId) ? body.cardId : "";
    const ownerId = typeof body.ownerId === "string" && /^[0-9a-f-]{36}$/i.test(body.ownerId) ? body.ownerId : "";
    const slug = cleanSlug(body.slug);
    if (!cardId && !ownerId && slug.length < 3) return Response.json({ message: "Select a valid customer card." }, { status: 400 });
    let card;
    if (ownerId && !cardId) {
      const customer = await prisma.user.findFirst({
        where: { id: ownerId, role: "CUSTOMER" },
        select: { id: true, name: true, email: true, disabled: true },
      });
      if (!customer) return Response.json({ message: "Customer not found." }, { status: 404 });
      if (customer.disabled) return Response.json({ message: "Reactivate this customer account before creating a card." }, { status: 409 });
      
      const existing = await prisma.digitalCard.findFirst({
        where: { ownerId },
        select: { id: true, slug: true, ownerId: true },
        orderBy: { createdAt: "asc" },
      });
      card = existing;
      if (!card) {
        const custName = customer.name || String(customer.email).split("@")[0];
        const base = cleanSlug(custName).slice(0, 32) || "customer";
        const generatedSlug = `mylux-${base}-${randomBytes(4).toString("hex")}`.slice(0, 80);
        
        card = await prisma.digitalCard.create({
          data: {
            ownerId,
            slug: generatedSlug,
            profile: { name: custName, email: customer.email },
            active: false,
          },
          select: { id: true, slug: true, ownerId: true },
        });
      }
    } else {
      card = cardId
        ? await prisma.digitalCard.findUnique({ where: { id: cardId }, select: { id: true, slug: true, ownerId: true } })
        : await prisma.digitalCard.findFirst({ where: { slug }, select: { id: true, slug: true, ownerId: true } });
    }
    if (!card) return Response.json({ message: "Card not found." }, { status: 404 });
    const token = randomBytes(8).toString("hex").toUpperCase();
    const code = `MLC-${token.match(/.{1,4}/g)?.join("-")}`;
    
    await prisma.digitalCard.update({
      where: { id: card.id },
      data: {
        activationCodeHash: hashActivationCode(code),
      },
    });

    await audit(actor, "CARD_ACTIVATION_PROVISIONED", "digital_card", card.id, null, { slug: card.slug, ownerId: card.ownerId });
    return Response.json({ cardId: card.id, slug: card.slug, activationCode: code });
  } catch (error) { return safeError(error); }
}
