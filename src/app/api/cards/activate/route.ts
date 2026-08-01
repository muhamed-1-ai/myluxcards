import { timingSafeEqual } from "node:crypto";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { hashActivationCode } from "@/lib/cards";
import { supabaseJson } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    if (!/^MLC-(?:[0-9A-F]{4}-){3}[0-9A-F]{4}$/i.test(code)) return Response.json({ message: "Enter the complete new activation code, for example MLC-12AB-34CD-56EF-7890." }, { status: 400 });
    // Match the one-time code within the signed-in customer's cards. This avoids
    // rejecting a valid code when the customer owns more than one unactivated card.
    const found = await supabaseJson(`/rest/v1/digital_cards?owner_id=eq.${identity.id}&select=id,slug,activation_code_hash`, {}, true);
    const submittedHash = hashActivationCode(code);
    const card = (found.data || []).find((candidate: { activation_code_hash?: string | null }) => {
      const storedHash = String(candidate.activation_code_hash || "");
      if (storedHash.length !== submittedHash.length) return false;
      return timingSafeEqual(Buffer.from(storedHash, "utf8"), Buffer.from(submittedHash, "utf8"));
    });
    if (!card) return Response.json({
      message: `This code is not assigned to a card owned by ${identity.email}. Reset the code for this customer's exact card in Admin → Card activation.`,
    }, { status: 400 });
    const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
    await supabaseJson(`/rest/v1/digital_cards?id=eq.${card.id}&owner_id=eq.${identity.id}`, { method: "PATCH", body: JSON.stringify({ activated_at: new Date().toISOString(), expires_at: expiry.toISOString(), active: true, activation_code_hash:null, updated_at:new Date().toISOString() }) }, true);
    return Response.json({ ok: true, cardId:card.id, slug:card.slug, expiry: expiry.toISOString() });
  } catch (error) { return safeError(error); }
}
