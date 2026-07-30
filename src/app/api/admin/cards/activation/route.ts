import { randomBytes } from "node:crypto";
import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanSlug, hashActivationCode } from "@/lib/cards";
import { supabaseJson } from "@/lib/supabaseAuth";

// The plaintext code is returned once to an authenticated administrator.
// Only a salted hash is stored.
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const slug = cleanSlug(body.slug);
    if (slug.length < 3) return Response.json({ message: "Enter a valid card slug." }, { status: 400 });
    const found = await supabaseJson(`/rest/v1/digital_cards?slug=eq.${encodeURIComponent(slug)}&select=id,slug,owner_id&limit=1`, {}, true);
    const card = found.data?.[0];
    if (!card) return Response.json({ message: "Card not found." }, { status: 404 });
    const code = `MLC-${randomBytes(4).toString("hex").toUpperCase()}`;
    await supabaseJson(`/rest/v1/digital_cards?id=eq.${card.id}`, { method:"PATCH", body:JSON.stringify({ activation_code_hash:hashActivationCode(code), activated_at:null, active:false, updated_at:new Date().toISOString() }) }, true);
    await audit(actor, "CARD_ACTIVATION_PROVISIONED", "digital_card", card.id, null, { slug });
    return Response.json({ cardId:card.id, slug, activationCode:code });
  } catch (error) { return safeError(error); }
}
