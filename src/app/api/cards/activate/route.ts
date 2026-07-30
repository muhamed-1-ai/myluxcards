import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { hashActivationCode } from "@/lib/cards";
import { supabaseJson } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.cardId || "");
    const code = String(body.code || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id) || code.length < 6) return Response.json({ message: "Enter the activation code supplied with your card." }, { status: 400 });
    const found = await supabaseJson(`/rest/v1/digital_cards?id=eq.${id}&owner_id=eq.${identity.id}&activation_code_hash=eq.${hashActivationCode(code)}&select=id&limit=1`, {}, true);
    if (!found.data?.[0]) return Response.json({ message: "The activation code is invalid or belongs to another card." }, { status: 400 });
    const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
    await supabaseJson(`/rest/v1/digital_cards?id=eq.${id}&owner_id=eq.${identity.id}`, { method: "PATCH", body: JSON.stringify({ activated_at: new Date().toISOString(), expires_at: expiry.toISOString(), active: true }) }, true);
    return Response.json({ ok: true, expiry: expiry.toISOString() });
  } catch (error) { return safeError(error); }
}
