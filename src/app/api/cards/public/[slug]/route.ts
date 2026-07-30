import { createHash } from "node:crypto";
import { cleanSlug, safePublicCard } from "@/lib/cards";
import { getSupabaseServiceConfig, supabaseJson } from "@/lib/supabaseAuth";
import { currentIdentity } from "@/lib/adminAuth";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!getSupabaseServiceConfig()) return Response.json({ message: "Cards are not configured." }, { status: 503 });
  const { slug } = await params;
  try {
    const { data } = await supabaseJson(`/rest/v1/digital_cards?slug=eq.${encodeURIComponent(cleanSlug(slug))}&select=id,owner_id,slug,profile,active,activated_at,expires_at&limit=1`, {}, true);
    if (!data?.[0]) return Response.json({ message: "Card not found." }, { status: 404 });
    const row = data[0];
    const publiclyActive = Boolean(row.active && row.activated_at && (!row.expires_at || new Date(row.expires_at) > new Date()));
    let previewAuthorized = false;
    if (!publiclyActive) {
      const identity = await currentIdentity();
      previewAuthorized = identity?.id === row.owner_id;
      if (!previewAuthorized) return Response.json({ message: "Card unavailable." }, { status: 404 });
    }
    return Response.json({ card: { ...safePublicCard(row), previewAuthorized } });
  } catch { return Response.json({ message: "Card unavailable." }, { status: 503 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const { data } = await supabaseJson(`/rest/v1/digital_cards?slug=eq.${encodeURIComponent(cleanSlug(slug))}&select=id,active,activated_at&limit=1`, {}, true);
    const card = data?.[0];
    if (!card?.active || !card.activated_at) return Response.json({ message: "Card unavailable." }, { status: 404 });
    const type = String(body.type || "");
    if (!["VIEW","CONTACT_SAVE","LINK_CLICK","SHARE"].includes(type)) return Response.json({ message: "Invalid event." }, { status: 400 });
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] || "";
    const day = new Date().toISOString().slice(0,10);
    const visitorHash = createHash("sha256").update(`${process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY}:${day}:${forwarded}:${request.headers.get("user-agent") || ""}`).digest("hex");
    await supabaseJson("/rest/v1/card_events", { method: "POST", body: JSON.stringify({ card_id: card.id, event_type: type, channel: ["NFC","QR","LINK","PREVIEW"].includes(body.channel) ? body.channel : "LINK", link_type: String(body.linkType || "").slice(0,40) || null, visitor_hash: visitorHash }) }, true);
    return Response.json({ ok: true });
  } catch { return Response.json({ ok: false }, { status: 202 }); }
}
