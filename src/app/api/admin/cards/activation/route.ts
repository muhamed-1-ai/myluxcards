import { randomBytes } from "node:crypto";
import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanSlug, hashActivationCode } from "@/lib/cards";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const cards = await supabaseJson("/rest/v1/digital_cards?select=id,owner_id,slug,active,activated_at,expires_at,activation_code_hash,created_at,updated_at&order=updated_at.desc&limit=500", {}, true);
    const rows = cards.data || [];
    const ownerIds = [...new Set(rows.map((card: { owner_id: string }) => card.owner_id).filter(Boolean))];
    let owners: Array<{ id:string; name:string|null; email:string }> = [];
    if (ownerIds.length) {
      const ids = ownerIds.map(id => `"${String(id).replaceAll('"', '')}"`).join(",");
      const result = await supabaseJson(`/rest/v1/profiles?id=in.(${encodeURIComponent(ids)})&select=id,name,email`, {}, true);
      owners = result.data || [];
    }
    const ownerById = new Map(owners.map(owner => [owner.id, owner]));
    return Response.json({ data: rows.map((card: Record<string, unknown>) => ({
      ...card,
      hasActivationCode: Boolean(card.activation_code_hash),
      activation_code_hash: undefined,
      owner: ownerById.get(String(card.owner_id)) || null,
    })) });
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
    const slug = cleanSlug(body.slug);
    if (!cardId && slug.length < 3) return Response.json({ message: "Select a valid customer card." }, { status: 400 });
    const filter = cardId ? `id=eq.${encodeURIComponent(cardId)}` : `slug=eq.${encodeURIComponent(slug)}`;
    const found = await supabaseJson(`/rest/v1/digital_cards?${filter}&select=id,slug,owner_id&limit=1`, {}, true);
    const card = found.data?.[0];
    if (!card) return Response.json({ message: "Card not found." }, { status: 404 });
    const token = randomBytes(8).toString("hex").toUpperCase();
    const code = `MLC-${token.match(/.{1,4}/g)?.join("-")}`;
    await supabaseJson(`/rest/v1/digital_cards?id=eq.${card.id}`, { method:"PATCH", body:JSON.stringify({ activation_code_hash:hashActivationCode(code), activated_at:null, active:false, updated_at:new Date().toISOString() }) }, true);
    await audit(actor, "CARD_ACTIVATION_PROVISIONED", "digital_card", card.id, null, { slug:card.slug, ownerId:card.owner_id });
    return Response.json({ cardId:card.id, slug:card.slug, activationCode:code });
  } catch (error) { return safeError(error); }
}
