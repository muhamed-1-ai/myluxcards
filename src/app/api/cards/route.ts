import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanCardProfile, cleanSlug, completeCardProfile } from "@/lib/cards";
import { pool } from "@/lib/db";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(identity.id)) return Response.json({ cards: [], leads: [] });
  try {
    // Scoped query: owner_id=eq.${identity.id}
    const cardsRes = await pool.query<{
      id: string;
      slug: string;
      profile: unknown;
      active: boolean;
      activated_at: Date | null;
      expires_at: Date | null;
    }>(
      `select id, slug, profile, active, activated_at, expires_at from digital_cards where owner_id = $1 order by updated_at desc`,
      [identity.id]
    );

    const [eventsRes, leadsRes] = await Promise.all([
      pool.query<{ card_id: string; event_type: string }>(
        `select e.card_id, e.event_type from card_events e join digital_cards c on c.id = e.card_id where c.owner_id = $1 order by e.created_at desc limit 5000`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
      pool.query<{
        id: string;
        card_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
        message: string | null;
        status: string;
        consent_at: Date;
        created_at: Date;
      }>(
        `select l.id, l.card_id, l.name, l.email, l.phone, l.company, l.message, l.status, l.consent_at, l.created_at from card_leads l join digital_cards c on c.id = l.card_id where c.owner_id = $1 order by l.created_at desc limit 500`,
        [identity.id]
      ).catch(() => ({ rows: [] })),
    ]);

    const counts: Record<string, Record<string, number>> = {};
    for (const event of eventsRes.rows) {
      counts[event.card_id] ||= {};
      counts[event.card_id][event.event_type] = (counts[event.card_id][event.event_type] || 0) + 1;
    }

    return Response.json({
      cards: cardsRes.rows.map((row) => ({
        id: row.id,
        ownerId: identity.id,
        slug: row.slug,
        ...completeCardProfile(row.profile),
        active: row.active,
        activatedAt: row.activated_at,
        expiry: row.expires_at ? row.expires_at.toISOString().slice(0, 10) : (row.profile as any)?.expiry || "",
        analytics: counts[row.id] || {},
      })),
      leads: leadsRes.rows.map((lead) => ({
        id: lead.id,
        card_id: lead.card_id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        message: lead.message,
        status: lead.status,
        consent_at: lead.consent_at,
        created_at: lead.created_at,
      })),
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(identity.id)) return Response.json({ message: "Invalid user identity." }, { status: 400 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body.toggleActive === true) {
      const id = String(body.id || "");
      const statusSlug = cleanSlug(body.slug);
      if (!/^[0-9a-f-]{36}$/i.test(id) && statusSlug.length < 3) return Response.json({ message: "Invalid card." }, { status: 400 });
      let cardRes = /^[0-9a-f-]{36}$/i.test(id)
        ? await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where id = $1 and owner_id = $2`, [id, identity.id])
        : null;
      if ((!cardRes || cardRes.rows.length === 0) && statusSlug.length >= 3) {
        cardRes = await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where slug = $1 and owner_id = $2`, [statusSlug, identity.id]);
      }
      const card = cardRes?.rows[0];
      if (!card) return Response.json({ message: "This card is not attached to the signed-in account. Activate it with its latest one-time code." }, { status: 409 });
      if (!card.activated_at) return Response.json({ message: "Activate this card with its one-time code before publishing it." }, { status: 409 });

      // active:!Boolean(card.active)
      const updated = await pool.query<{ id: string; slug: string; profile: unknown; active: boolean; activated_at: Date | null }>(
        `update digital_cards set active = not active, updated_at = now() where id = $1 returning id, slug, profile, active, activated_at`,
        [card.id]
      );
      const row = updated.rows[0];
      return Response.json({ card: { id: row.id, ownerId: identity.id, slug: row.slug, ...(row.profile as any), active: row.active, activatedAt: row.activated_at } });
    }

    const slug = cleanSlug(body.slug);
    if (slug.length < 3) return Response.json({ message: "Choose a valid card URL." }, { status: 400 });
    const profile = cleanCardProfile(body);

    // slug=eq.${encodeURIComponent(statusSlug)}&owner_id=eq.${identity.id}
    let foundRes = body.id && /^[0-9a-f-]{36}$/i.test(body.id)
      ? await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where id = $1 and owner_id = $2`, [body.id, identity.id])
      : await pool.query<{ id: string; active: boolean; activated_at: Date | null }>(`select id, active, activated_at from digital_cards where slug = $1 and owner_id = $2`, [slug, identity.id]);

    const found = foundRes.rows[0];
    let row;
    if (found) {
      const stateChange = body.updateActive === true && Boolean(found.activated_at);
      const newActive = stateChange ? (body.toggleActive === true ? !Boolean(found.active) : Boolean(body.active)) : found.active;
      const updated = await pool.query<{ id: string; slug: string; profile: unknown; active: boolean; activated_at: Date | null }>(
        `update digital_cards set slug = $1, profile = $2, active = $3, updated_at = now() where id = $4 returning id, slug, profile, active, activated_at`,
        [slug, JSON.stringify(profile), newActive, found.id]
      );
      row = updated.rows[0];
    } else {
      const inserted = await pool.query<{ id: string; slug: string; profile: unknown; active: boolean; activated_at: Date | null }>(
        `insert into digital_cards(owner_id, slug, profile, active) values($1, $2, $3, false) returning id, slug, profile, active, activated_at`,
        [identity.id, slug, JSON.stringify(profile)]
      );
      row = inserted.rows[0];
    }
    return Response.json({ card: { id: row.id, ownerId: identity.id, slug: row.slug, ...(row.profile as any), active: row.active, activatedAt: row.activated_at } });
  } catch (error: any) {
    if (error?.code === "23505") return Response.json({ message: "That card URL is already taken." }, { status: 409 });
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

    const deleted = await pool.query(`delete from digital_cards where id = $1 and owner_id = $2 returning id`, [id, identity.id]);
    if (deleted.rows.length === 0) return Response.json({ message: "Card not found or already removed." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return safeError(error);
  }
}
