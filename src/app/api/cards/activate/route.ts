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
    // An unused activation code is a bearer credential supplied with a physical
    // card. The signed-in customer who possesses it claims that exact card.
    const found = await supabaseJson("/rest/v1/digital_cards?activation_code_hash=not.is.null&select=id,owner_id,slug,activation_code_hash&limit=5000", {}, true);
    const submittedHash = hashActivationCode(code);
    const card = (found.data || []).find((candidate: { activation_code_hash?: string | null }) => {
      const storedHash = String(candidate.activation_code_hash || "");
      if (storedHash.length !== submittedHash.length) return false;
      return timingSafeEqual(Buffer.from(storedHash, "utf8"), Buffer.from(submittedHash, "utf8"));
    });
    if (!card) return Response.json({ message: "This activation code is invalid, expired, or has already been used." }, { status: 400 });
    if (card.owner_id !== identity.id) {
      const [events, leads] = await Promise.all([
        supabaseJson(`/rest/v1/card_events?card_id=eq.${card.id}&select=id&limit=1`, {}, true),
        supabaseJson(`/rest/v1/card_leads?card_id=eq.${card.id}&select=id&limit=1`, {}, true),
      ]);
      if (events.data?.length || leads.data?.length) return Response.json({ message: "This used card has private history and cannot be transferred. Ask MyLuxCards to issue a new card." }, { status: 409 });
    }
    const claimed = await supabaseJson(`/rest/v1/digital_cards?id=eq.${card.id}&activation_code_hash=eq.${submittedHash}`, { method: "PATCH", body: JSON.stringify({ owner_id:identity.id, activated_at: new Date().toISOString(), expires_at: null, active: true, activation_code_hash:null, updated_at:new Date().toISOString() }) }, true);
    if (!claimed.data?.[0]) return Response.json({ message: "This activation code has already been used. Ask MyLuxCards for a new code." }, { status: 409 });
    return Response.json({ ok: true, cardId:card.id, slug:card.slug });
  } catch (error) { return safeError(error); }
}
