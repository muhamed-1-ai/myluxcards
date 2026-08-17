import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanCardProfile, cleanSlug, completeCardProfile } from "@/lib/cards";
import { supabaseJson } from "@/lib/supabaseAuth";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  try {
    // Card state is critical and must still load if optional analytics or lead
    // queries are temporarily unavailable or their migration is incomplete.
    const { data: cards } = await supabaseJson(`/rest/v1/digital_cards?owner_id=eq.${identity.id}&select=*&order=updated_at.desc`, {}, true);
    const [eventResult,leadResult] = await Promise.all([
      supabaseJson(`/rest/v1/card_events?digital_cards.owner_id=eq.${identity.id}&select=card_id,event_type,created_at,digital_cards!inner(owner_id)&order=created_at.desc&limit=5000`, {}, true).catch(()=>({data:[]})),
      supabaseJson(`/rest/v1/card_leads?digital_cards.owner_id=eq.${identity.id}&select=id,card_id,name,email,phone,company,message,status,consent_at,created_at,digital_cards!inner(owner_id)&order=created_at.desc&limit=500`, {}, true).catch(()=>({data:[]})),
    ]);
    const events = eventResult.data, leads = leadResult.data;
    const counts: Record<string, Record<string, number>> = {};
    for (const event of events || []) {
      counts[event.card_id] ||= {};
      counts[event.card_id][event.event_type] = (counts[event.card_id][event.event_type] || 0) + 1;
    }
    return Response.json({
      cards: (cards || []).map((row: any) => ({ id: row.id, ownerId: identity.id, slug: row.slug, ...completeCardProfile(row.profile), active: row.active, activatedAt: row.activated_at, expiry: row.expires_at?.slice(0,10) || row.profile?.expiry || "", analytics: counts[row.id] || {} })),
      leads: (leads || []).map(({ digital_cards: _join, ...lead }: any) => lead),
    });
  } catch (error) { return safeError(error); }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.toggleActive === true) {
      const id = String(body.id || "");
      const statusSlug = cleanSlug(body.slug);
      if (!/^[0-9a-f-]{36}$/i.test(id) && statusSlug.length < 3) return Response.json({ message:"Invalid card." }, { status:400 });
      let current = /^[0-9a-f-]{36}$/i.test(id) ? await supabaseJson(`/rest/v1/digital_cards?id=eq.${encodeURIComponent(id)}&owner_id=eq.${identity.id}&select=*&limit=1`, {}, true) : { data:[] };
      if (!current.data?.[0] && statusSlug.length >= 3) current = await supabaseJson(`/rest/v1/digital_cards?slug=eq.${encodeURIComponent(statusSlug)}&owner_id=eq.${identity.id}&select=*&limit=1`, {}, true);
      const card = current.data?.[0];
      if (!card) return Response.json({ message:"This card is not attached to the signed-in account. Activate it with its latest one-time code." }, { status:409 });
      if (!card.activated_at) return Response.json({ message:"Activate this card with its one-time code before publishing it." }, { status:409 });
      const changed = await supabaseJson(`/rest/v1/digital_cards?id=eq.${encodeURIComponent(card.id)}&owner_id=eq.${identity.id}`, { method:"PATCH", body:JSON.stringify({ active:!Boolean(card.active), updated_at:new Date().toISOString() }) }, true);
      const row = changed.data?.[0];
      return Response.json({ card:{ id:row.id,ownerId:identity.id,slug:row.slug,...row.profile,active:row.active,activatedAt:row.activated_at } });
    }
    const slug = cleanSlug(body.slug);
    if (slug.length < 3) return Response.json({ message: "Choose a valid card URL." }, { status: 400 });
    const profile = cleanCardProfile(body);
    const existing = body.id && /^[0-9a-f-]{36}$/i.test(body.id)
      ? `id=eq.${encodeURIComponent(body.id)}&owner_id=eq.${identity.id}`
      : `slug=eq.${encodeURIComponent(slug)}&owner_id=eq.${identity.id}`;
    const found = await supabaseJson(`/rest/v1/digital_cards?${existing}&select=id,active,activated_at&limit=1`, {}, true);
    let saved;
    if (found.data?.[0]) {
      const stateChange = body.updateActive === true && Boolean(found.data[0].activated_at);
      const changes:Record<string,unknown> = { slug, profile, updated_at: new Date().toISOString() };
      if (stateChange) changes.active = body.toggleActive === true ? !Boolean(found.data[0].active) : Boolean(body.active);
      saved = await supabaseJson(`/rest/v1/digital_cards?id=eq.${found.data[0].id}&owner_id=eq.${identity.id}`, {
        method: "PATCH", body: JSON.stringify(changes),
      }, true);
    } else {
      saved = await supabaseJson("/rest/v1/digital_cards", {
        method: "POST", body: JSON.stringify({ owner_id: identity.id, slug, profile, active: false }),
      }, true);
    }
    const row = saved.data?.[0];
    return Response.json({ card: { id: row.id, ownerId: identity.id, slug: row.slug, ...row.profile, active: row.active, activatedAt: row.activated_at } });
  } catch (error: any) {
    if (error?.details?.code === "23505") return Response.json({ message: "That card URL is already taken." }, { status: 409 });
    return safeError(error);
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid card." }, { status: 400 });
    const removed = await supabaseJson(`/rest/v1/digital_cards?id=eq.${id}&owner_id=eq.${identity.id}`, { method:"DELETE" }, true);
    if (!removed.data?.length) return Response.json({ message:"Card not found or already removed." }, { status:404 });
    return Response.json({ ok:true });
  } catch (error) { return safeError(error); }
}
