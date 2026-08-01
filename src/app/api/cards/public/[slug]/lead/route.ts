import { cleanSlug } from "@/lib/cards";
import { validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

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
    const { data } = await supabaseJson(`/rest/v1/digital_cards?slug=eq.${encodeURIComponent(cleanSlug(slug))}&active=eq.true&select=id,activated_at&limit=1`, {}, true);
    if (!data?.[0]?.activated_at) return Response.json({ message: "Card unavailable." }, { status: 404 });
    await supabaseJson("/rest/v1/card_leads", { method: "POST", body: JSON.stringify({ card_id: data[0].id, name, email: email || null, phone: phone || null, company: String(body.company || "").trim().slice(0,160) || null, message: String(body.message || "").trim().slice(0,1000) || null, consent_at: new Date().toISOString() }) }, true);
    await supabaseJson("/rest/v1/card_events", { method: "POST", body: JSON.stringify({ card_id: data[0].id, event_type: "LEAD", channel: "LINK" }) }, true);
    return Response.json({ ok: true }, { status: 201 });
  } catch { return Response.json({ message: "Your details could not be sent." }, { status: 500 }); }
}
