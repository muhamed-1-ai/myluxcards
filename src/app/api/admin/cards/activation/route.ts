import { randomBytes } from "node:crypto";
import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanSlug, hashActivationCode } from "@/lib/cards";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    // Activation is a customer workflow, not only a card workflow. Load both
    // independently so customers without a card are still available for
    // provisioning and an optional owner lookup can never empty the page.
    const [cards, customers] = await Promise.all([
      supabaseJson("/rest/v1/digital_cards?select=id,owner_id,slug,active,activated_at,expires_at,activation_code_hash,created_at,updated_at&order=updated_at.desc&limit=500", {}, true),
      supabaseJson("/rest/v1/profiles?role=eq.CUSTOMER&select=id,name,email,disabled,created_at&order=created_at.desc&limit=500", {}, true),
    ]);
    const rows = cards.data || [];
    const owners: Array<{ id:string; name:string|null; email:string; disabled?:boolean; created_at:string }> = customers.data || [];
    const ownerById = new Map(owners.map(owner => [owner.id, owner]));
    const cardRows = rows.map((card: Record<string, unknown>) => ({
      ...card,
      hasActivationCode: Boolean(card.activation_code_hash),
      activation_code_hash: undefined,
      owner: ownerById.get(String(card.owner_id)) || null,
    }));
    const customersWithCards = new Set(rows.map((card: { owner_id?:string }) => card.owner_id).filter(Boolean));
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
    return Response.json({ data: [...cardRows, ...customersWithoutCards] });
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
      const customerResult = await supabaseJson(`/rest/v1/profiles?id=eq.${encodeURIComponent(ownerId)}&role=eq.CUSTOMER&select=id,name,email,disabled&limit=1`, {}, true);
      const customer = customerResult.data?.[0];
      if (!customer) return Response.json({ message: "Customer not found." }, { status: 404 });
      if (customer.disabled) return Response.json({ message: "Reactivate this customer account before creating a card." }, { status: 409 });
      const existing = await supabaseJson(`/rest/v1/digital_cards?owner_id=eq.${encodeURIComponent(ownerId)}&select=id,slug,owner_id&order=created_at.asc&limit=1`, {}, true);
      card = existing.data?.[0];
      if (!card) {
        const base = cleanSlug(customer.name || String(customer.email).split("@")[0]).slice(0, 32) || "customer";
        const generatedSlug = `mylux-${base}-${randomBytes(4).toString("hex")}`.slice(0, 80);
        const created = await supabaseJson("/rest/v1/digital_cards", { method:"POST", body:JSON.stringify({
          owner_id: ownerId,
          slug: generatedSlug,
          profile: { name: customer.name || String(customer.email).split("@")[0], email: customer.email },
          active: false,
        }) }, true);
        card = created.data?.[0];
      }
    } else {
      const filter = cardId ? `id=eq.${encodeURIComponent(cardId)}` : `slug=eq.${encodeURIComponent(slug)}`;
      const found = await supabaseJson(`/rest/v1/digital_cards?${filter}&select=id,slug,owner_id&limit=1`, {}, true);
      card = found.data?.[0];
    }
    if (!card) return Response.json({ message: "Card not found." }, { status: 404 });
    const token = randomBytes(8).toString("hex").toUpperCase();
    const code = `MLC-${token.match(/.{1,4}/g)?.join("-")}`;
    // Issuing a replacement code must never take a customer's working card
    // offline. Existing activation/publication state changes only when the
    // customer explicitly uses the status switch or claims an unactivated card.
    await supabaseJson(`/rest/v1/digital_cards?id=eq.${card.id}`, { method:"PATCH", body:JSON.stringify({ activation_code_hash:hashActivationCode(code), updated_at:new Date().toISOString() }) }, true);
    await audit(actor, "CARD_ACTIVATION_PROVISIONED", "digital_card", card.id, null, { slug:card.slug, ownerId:card.owner_id });
    return Response.json({ cardId:card.id, slug:card.slug, activationCode:code });
  } catch (error) { return safeError(error); }
}
